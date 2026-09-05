# Zajem podatkov za poslovno analitiko

Poslovne definicije so v [business-analytics-definitions.md](business-analytics-definitions.md). Zajem ni del blagajne. V pogledu Poštnina oziroma Laboratorij odprite **Dejanske meritve**, naložite naročilo po ID in vnesite izmerjene podatke ter vir.

Prazno polje ohrani neznan podatek. Dejanska zapakirana masa ni masa artiklov; dejansko število paketov je ločeno od obračunskega `parcel_count`. Čas pomeni aktivne minute priprave. Strošek prevoznika in vračila blaga so brez DDV. Zaračunano poštnino je mogoče primerjati s stroškom šele, ko je potrjena njena stopnja DDV; stopnje artiklov ne prevzemamo.

`GET/POST /api/admin/analytics/orders/{orderId}/measurements` preverita obstoječo administratorsko sejo. POST zahteva `expectedRevision`, `reason` in `fields`; neznana polja, neveljavne mere in denarne vrednosti se zavrnejo. Zastarela revizija vrne 409. Sprememba, trajna revizijska sled v `order_analytics_change_log` in obstoječi revizijski dogodek se zapišejo v isti transakciji. Osnovna sled je trajna tudi, če se pozneje izbriše naročilo; ne vsebuje naslovov ali e-poštnih naslovov.

## Zgodovina in identiteta

- Novi oddani zapisi in prehod osnutka v oddano naročilo dobijo nespremenljiv `analytics_submitted_at` in `analytics_snapshot_json` s tipom, imenom, naslovom, vrednostjo po popustih, davkom in poštnim izračunom. Poznejše spremembe stranke ali naročila ne popravljajo tega posnetka.
- Prvi popolni prehod v `sent` oziroma `finished` pri sprejeti in zavezujoči pogodbi ohrani `analytics_fulfilled_at`, `analytics_fulfilled_merchandise_net` in `analytics_fulfilled_lines_json`. Naslednje spremembe statusa tega dogodka ne podvojijo.
- `historical_unit_cost_net` se zajame iz takrat znanega stroška različice ob oddaji oziroma novem vnosu vrstice. Osnutek s predhodno vnesenimi vrsticami dobi stroškovni posnetek šele ob oddaji. Podedovane vrstice ostanejo brez stroška.
- `merchandise_refund_net` je preverjeni kumulativni znesek vračil blaga. `refund_history_complete` izrecno označi popolnost evidence. Sprememba plačila v `refunded` popolnost razveljavi, dokler skrbnik ne potrdi točnega zneska. Prva oddaja začne z znanimi ničelnimi vračili. Podedovane evidence se ne označijo samodejno kot popolne.
- `customer_directory_profile_id` in `school_directory_row_id` se vežeta samo po preverjenem trajnem identifikatorju. Šolska enota ima prednost pred skupnim računovodskim profilom. Stari izpeljani ključi iz imen, e-poštnih naslovov ali poštnih številk se ne prevzemajo. Identifikator ostane zgodovinska oznaka tudi po odstranitvi vrstice imenika; ni kaskadnega spreminjanja zgodovine.

## Namestitev obstoječe baze

Najprej ustavite ročne in mesečne uvoze naslovov. Na preverjeno obstoječo bazo, ki že izpolnjuje pogodbo v2, po vrsti uporabite:

1. `database/migrations/20260905_business_analytics.sql`
2. `database/migrations/20260905_analytics_geography.sql`
3. `database/migrations/20260905_schema_contract_v3.sql`

Vsak artefakt ima lastno transakcijo. Geografska migracija doda izbirna polja lokalnemu imeniku naslovov; pred ponovnim zagonom osveževanja namestite tudi novi uvoznik, ki jih ohrani na začasni tabeli. Ne izvajajte celotne `schema.sql` nad obstoječo bazo. Sveža prazna baza uporabi samo celotno `database/schema.sql`, ki vsebuje iste definicije in pogodbo `20260905.business-analytics-v3`.

Z izrecno nastavljenim ciljnim `DATABASE_URL`:

```text
npm run check:schema-contract
npm run check:database-schema
npx tsx scripts/backfill-business-analytics.ts --database-name=PREVERJENO_IME_BAZE --apply
npm run addresses:sync
npm run geography:import
npm run geography:backfill
```

Ohranitev starih posnetkov obdeluje največ 500 vrstic na transakcijo in nadaljuje samo pri naročilih brez posnetka. Ponoven zagon je idempotenten; prekinitev izgubi največ trenutni paket. Podedovani posnetek je označen `origin: legacy`: izvorni datum oddaje lahko temelji le na `created_at`, tip/naslov/vrednost na še razpoložljivem zapisu. Podedovana realizacija uporabi prvi dnevniški prehod `sent/finished` in ohranjeno trenutno vrednost z oznako `analytics_fulfilment_origin: legacy`. To ni dokaz, da so ti podatki bili isti že ob oddaji ali realizaciji. Manjkajoči stroški, vračila, meritve in izgubljeni dogodki se ne dopolnijo z izmišljenimi vrednostmi.

Uvoz prostorskih referenc in zgodovinska preslikava sta ločena ukaza. Osvežitev meje ne prepiše samodejno shranjenih preslikav ali ročnih popravkov. Referenčno različico, starost podatkov in nerešene naslove prikazuje Zemljevid.

## Preverjanje

```text
npx tsx --test tests/unit/business-analytics-measurements.test.ts tests/unit/database-schema-contract.test.ts
npx tsx scripts/check-business-analytics-database.ts
npx tsx scripts/check-business-analytics-api.ts
```

Zadnja dva ukaza zahtevata varovala obstoječega okolja E2E: izrecno lokalno bazo, ujemajoči se imenski prostor in identiteto. Preizkus baze vse svoje poslovne vrstice povrne z rollbackom. API-preizkus zahteva pripravljene označene analitične podatke in preveri identiteto baze prek zdravja izoliranega strežnika; preverjene meritve po testu obnovi in ohrani revizijsko sled. `tests/fixtures/business-analytics-seed.ts` lahko napolni samo izolirano bazo E2E; nikoli se ne naloži iz aplikacije, migracije ali produkcijskega opravila.
