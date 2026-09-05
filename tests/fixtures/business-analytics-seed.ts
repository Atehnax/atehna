import { Pool } from 'pg';
import { readE2eEnvironment } from '../../scripts/e2e-database.mjs';
import { calculateShipping, parseShippingConfiguration } from '../../src/shared/domain/shipping/shipping';
import { backfillGeography, addressFingerprint } from '../../src/shared/server/geographyAnalytics';
import type { AddressSnapshot } from '../../src/shared/domain/analytics/geography';

// Deliberately labelled deterministic fixtures. The repository guard refuses non-E2E databases.
const { databaseUrl, databaseName } = readE2eEnvironment();
const pool = new Pool({ connectionString: databaseUrl, ssl: false });
const client = await pool.connect();
const ages = [0, 1, 2, 5, 8, 14, 25, 35, 45, 60, 75, 89, 95, 140, 200, 365, 430, 620, 700];
const values = [120, 80, 0, 450, 210, 95, 360, 1250, 35, 560, 175, 900, 225, 75, 110, 170, 340, 90, 130];
const statuses = ['finished', 'sent', 'finished', 'finished', 'finished', 'sent', 'sent', 'received', 'cancelled', 'finished', 'partially_sent', 'finished'];
const places = ['Ljubljana', 'Maribor', 'Kranj'];
const result: Array<{ id: string; number: string; date: string; type: string; net: number; status: string; geography: string }> = [];
try {
  const identity = (await client.query('select current_database() as name')).rows[0];
  if (identity.name !== databaseName) throw new Error('Wrong isolated fixture destination.');
  const existing = await client.query("select id from orders where order_number like 'ANALYTICS-FIXTURE-%' limit 1");
  if (existing.rowCount) throw new Error('Analytics fixtures already exist. Preserve them; do not duplicate this seed.');
  const addresses = (await client.query(
    `select distinct on (municipality_name) municipality_name, address_line_1, postal_code, postal_name, gurs_house_number_id, municipality_id, region_id
    from gurs_addresses where municipality_name = any($1::text[]) and municipality_id is not null
    order by municipality_name, gurs_house_number_id`, [places]
  )).rows;
  if (addresses.length !== 3) throw new Error('Import the verified official GURS address reference before geographic fixtures.');
  const addressByName = new Map(addresses.map(address => [address.municipality_name, address]));
  const variant = (await client.query('select id,item_id from catalog_item_variants order by id limit 1')).rows[0];
  const config = parseShippingConfiguration((await client.query('select config_json from shipping_settings limit 1')).rows[0].config_json);
  await client.query('begin');
  for (const [id, name] of [
    ['analytics-fixture-school-billing', 'PREIZKUS ANALITIKE – skupni računovodski profil'],
    ['analytics-fixture-company', 'PREIZKUS ANALITIKE – Podjetje'],
    ['analytics-fixture-person', 'PREIZKUS ANALITIKE – Posameznik']
  ]) await client.query('insert into customer_directory_profiles(id,name) values($1,$2) on conflict(id) do nothing',[id,name]);
  for (const place of places.slice(0,2)) {
    const address=addressByName.get(place)!;
    await client.query("insert into school_directory_rows(id,position,cells) values($1,999,$2::jsonb) on conflict(id) do nothing",[
      'analytics-fixture-school-'+place.toLowerCase(),
      JSON.stringify({naziv:'PREIZKUS ANALITIKE – Podružnica '+place,naslov:address.address_line_1,'postna-stevilka':address.postal_code,posta:address.postal_name,obcina:place})
    ]);
  }
  for (let index=0;index<ages.length;index++) {
    const place=places[index%3]; const address=addressByName.get(place)!;
    const geography=index===4?'foreign':index===5?'unknown_country':index===6?'unresolved':index===9?'region_only':place;
    const type=['school','company','individual'][index%3];
    const status=statuses[index]??'finished';
    const name='PREIZKUS ANALITIKE – '+(type==='school'?'Podružnica '+(index%2?'Maribor':'Ljubljana'):type==='company'?'Podjetje':'Posameznik');
    const now=new Date(); const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-ages[index],8,0,0));
    const subtotal=values[index]; const quantity=1+(index%5);
    const shipping=calculateShipping(config,[{productId:String(variant.item_id),variantId:String(variant.id),sku:'ANALYTICS-FIXTURE',name:'PREIZKUS – postavka',quantity,measurement:{weightGrams:300+index*125,lengthMm:100,widthMm:200,heightMm:10}}],{merchandiseSubtotalCents:Math.round(subtotal*122),parcelCount:1+(index%3===0?1:0)});
    if(shipping.status!=='calculated'||shipping.combinedWeightGrams===null)throw new Error('Fixture shipping rule engine could not calculate.');
    const snapshotAddress = {
      addressLine1: geography==='foreign'?'Testgasse 1':geography==='unknown_country'?'Neznana država':geography==='unresolved'?'Neobstoječa testna ulica 9999':geography==='region_only'?'Manjka hišna številka':address.address_line_1,
      addressLine2:null,city:geography==='foreign'?'Graz':address.postal_name,
      postalCode:geography==='foreign'?'8010':address.postal_code,
      countryCode:geography==='foreign'?'AT':geography==='unknown_country'?'':'SI',
      gursHouseNumberId:['foreign','unknown_country','unresolved','region_only'].includes(geography)?null:address.gurs_house_number_id
    };
    const number='ANALYTICS-FIXTURE-'+String(index+1).padStart(2,'0');
    const created = await client.query(
      `insert into orders(order_number,customer_type,organization_name,contact_name,email,address_line1,address_line2,city,postal_code,country_code,gurs_house_number_id,subtotal,tax,shipping,automatic_shipping,total,shipping_snapshot_json,parcel_count,created_at,shipping_tax_rate,customer_directory_profile_id,school_directory_row_id)
      values($1,$2,$3,'Preizkus','analytics-fixture@example.test',$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14::jsonb,$15,$16,0.22,$17,$18) returning id`,
      [number,type,name,snapshotAddress.addressLine1,null,snapshotAddress.city,snapshotAddress.postalCode,snapshotAddress.countryCode,snapshotAddress.gursHouseNumberId,subtotal,(subtotal*.22).toFixed(2),shipping.finalAmountCents/100,(subtotal*1.22+shipping.finalAmountCents/100).toFixed(2),JSON.stringify(shipping),shipping.parcelCount,date.toISOString(),index===6?null:type==='school'?'analytics-fixture-school-billing':type==='company'?'analytics-fixture-company':'analytics-fixture-person',type==='school'?'analytics-fixture-school-'+(index%2?'maribor':'ljubljana'):null]
    );
    const id=String(created.rows[0].id);
    const line = await client.query(
      `insert into order_items(order_id,catalog_item_id,catalog_variant_id,sku,name,quantity,base_unit_net,unit_net,unit_tax,unit_gross,line_net,line_tax,line_gross,tax_rate)
      values($1,$2,$3,'ANALYTICS-FIXTURE','PREIZKUS – postavka',$4,$5,$5,$6,$7,$8,$9,$10,0.22) returning id`,
      [id,variant.item_id,variant.id,quantity,(subtotal/quantity).toFixed(2),(subtotal*.22/quantity).toFixed(2),(subtotal*1.22/quantity).toFixed(2),subtotal,(subtotal*.22).toFixed(2),(subtotal*1.22).toFixed(2)]
    );
    if(index%4===3) await client.query('update order_items set historical_unit_cost_net=null where id=$1',[line.rows[0].id]);
    await client.query(
      `insert into order_line_snapshots(order_id,order_item_id,line_number,catalog_item_id,catalog_variant_id,product_slug,product_name,variant_name,sku,quantity,base_unit_net,unit_net,unit_tax,unit_gross,line_net,line_tax,line_gross,tax_rate,historical_unit_cost_net)
      select order_id,id,1,catalog_item_id,catalog_variant_id,'aluminijasta-plosca',name,'Preizkus',sku,quantity,base_unit_net,unit_net,unit_tax,unit_gross,line_net,line_tax,line_gross,tax_rate,historical_unit_cost_net from order_items where id=$1`,
      [line.rows[0].id]
    );
    if(index%4===3) await client.query('update order_line_snapshots set historical_unit_cost_net=null where order_id=$1',[id]);
    for (let extra = 2; extra <= 1 + index % 4; extra++) {
      const extraLine = await client.query(
        `insert into order_items(order_id,sku,name,quantity,base_unit_net,unit_net,unit_tax,unit_gross,line_net,line_tax,line_gross,tax_rate)
        values($1,$2,$3,1,0,0,0,0,0,0,0,0.22) returning id`,
        [id,'ANALYTICS-FIXTURE-SUPPLY-'+extra,'PREIZKUS – dodatna ničelna postavka '+extra]
      );
      await client.query(
        `insert into order_line_snapshots(order_id,order_item_id,line_number,product_slug,product_name,variant_name,sku,quantity,base_unit_net,unit_net,unit_tax,unit_gross,line_net,line_tax,line_gross,tax_rate)
        values($1,$2,$3,'analytics-fixture','PREIZKUS – dodatna ničelna postavka','Preizkus',$4,1,0,0,0,0,0,0,0,0.22)`,
        [id,extraLine.rows[0].id,extra,'ANALYTICS-FIXTURE-SUPPLY-'+extra]
      );
    }

    await client.query(
      `update orders set status=$2,contract_status='accepted',contract_accepted_at=$3,committed_at=$3,
      contract_accepted_actor_type='admin',contract_accepted_actor_id='analytics-fixture',
      contract_acceptance_evidence_json='{"fixture":true}'::jsonb,
      analytics_fulfilled_at=case when $2 in ('sent','finished') then $3::timestamptz else null end,
      analytics_fulfilled_merchandise_net=case when $2 in ('sent','finished') then subtotal else null end,
      analytics_fulfilment_origin=case when $2 in ('sent','finished') then 'captured' else null end,
      analytics_fulfilled_lines_json=case when $2 in ('sent','finished') then (
        select jsonb_agg(jsonb_build_object('id',order_items.id::text,'key','variant:'||order_items.catalog_variant_id::text,'name',order_items.name,'category','fixture','quantity',order_items.quantity,'lineNetCents',(order_items.line_net*100)::bigint,'unitCostCents',(order_items.historical_unit_cost_net*100)::bigint))
        from order_items where order_items.order_id=orders.id
      ) else null end where id=$1`,
      [id,status,new Date(date.getTime()+3600000).toISOString()]
    );
    await client.query("insert into order_status_logs(order_id,previous_status,new_status,created_at) values($1,null,'received',$2),($1,'received',$3,$4)",[id,date.toISOString(),status,new Date(date.getTime()+3600000).toISOString()]);
    if(index===3)await client.query("update orders set payment_status='refunded' where id=$1",[id]);
    else if(index===0||index===5)await client.query('update orders set merchandise_refund_net=$2,refund_history_complete=true where id=$1',[id,index===0?'20.00':'20.00']);
    if(index%3!==2)await client.query(
      `update orders set actual_packed_weight_grams=$2,actual_carrier_cost_net=$3,actual_parcel_count=$4,preparation_minutes=$5,actual_oversize=$6,analytics_measurement_revision=1,analytics_measured_at=now(),analytics_measured_by='analytics-fixture' where id=$1`,
      [id,shipping.combinedWeightGrams+200,(3.25+index*.9).toFixed(2),shipping.parcelCount,(4+quantity*2+index*.5).toFixed(2),index%4===0]
    );
    if(geography==='region_only') {
      const version=(await client.query("select reporting_version from analytics_geography_state where key='active'")).rows[0].reporting_version;
      await client.query(
        `insert into order_geography_resolutions(order_id,address_basis,address_fingerprint,address_snapshot_json,region_id,resolution_status,resolution_method,source_version,manual_override)
        values($1,'delivery_customer_snapshot',$2,$3::jsonb,$4,'region_only','isolated_test_region_only',$5,true)`,
        [id,addressFingerprint(snapshotAddress as AddressSnapshot),JSON.stringify(snapshotAddress),address.region_id,version]
      );
    }
    result.push({id,number,date:date.toISOString(),type,net:subtotal,status,geography});
  }
  await client.query('commit');
  console.info(JSON.stringify({database:databaseName,fixtureOrders:result,expectedDirect90D:{orderCount:12,activityValue:4235,fulfilledCount:9,knownRefundNetValue:2285,refundUnknownOrders:1,zeroValueOrders:1,cancelledOrders:1},note:'Only disposable E2E fixture data; all labels explicitly identify test records.'},null,2));
} catch(error) { await client.query('rollback'); throw error; }
finally { client.release(); await pool.end(); }
await backfillGeography({batchSize:100});
process.exit(0);
