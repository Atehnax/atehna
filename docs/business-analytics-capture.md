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

## Namestitev in inicializacija

Nova prazna baza uporabi samo `database/schema.sql`, ki atomarno namesti
trenutne definicije in pogodbo `20260907.historical-orders-v6`. Postopek je v
[navodilih za svežo namestitev](shipping-rollout.md). Preverjevalnik obstoječo
bazo samo prebere; ne spreminja podatkov, zgodovine namestitev ali nastavitev.

Po preverjeni namestitvi z izrecno nastavljenim ciljnim `DATABASE_URL`:

```text
npm run check:schema-contract
npm run check:database-schema
npm run addresses:sync
npm run geography:import -- --bundled
npm run geography:backfill
```

`geography:backfill` ponavljajte, dokler je `remaining=true`. Začetni
`--bundled` ohrani pregledano referenčno različico; poznejši
`geography:import` osveži kandidata brez tihe zamenjave poročevalske različice.
Uvoz prostorskih referenc in preslikava naslovov sta ločena ukaza. Osvežitev
meje ne prepiše shranjenih preslikav ali ročnih popravkov.

Trenutni sprožilci zajamejo posnetke ob novih oddajah in realizaciji naročil.
Manjkajoči stroški, vračila, meritve in izgubljeni zgodovinski dogodki ostanejo
neznani. Že shranjene oznake `origin: legacy` ostanejo pošteno označena
zgodovinska dokazila; sveža namestitev jih ne izmišljuje ali dopolnjuje.
Zamenjava skupne baze in odstranitev njenih podatkov zahtevata ločeno
odobren točen obseg ter preverljivo obnovljivo varnostno kopijo.

## Trajna diagnostika

`diagnostics_events` shranjuje dogodke novega zbiralnika. Dnevno opravilo odstrani zapise, starejše od sedmih dni; med zagonoma ali ob napaki opravila so lahko fizično prisotni tudi starejši zapisi. Dogodek vsebuje: sled, kontekst, operacijo, vrsto, trajanje, velikost, oznako napake in omejene faze/podrobnosti. Ne shranjuje teles zahtev, glav ali osebnih podatkov. Indeksi pokrivajo čas, kontekst/čas in napake. Stari konfiguracijski gradnik ni povezan z novo diagnostiko.

## Preverjanje

```text
npx tsx --test tests/unit/business-analytics-measurements.test.ts tests/unit/database-schema-contract.test.ts
npx tsx scripts/check-business-analytics-database.ts
npx tsx scripts/check-business-analytics-api.ts
```

Zadnja dva ukaza zahtevata varovala obstoječega okolja E2E: izrecno lokalno bazo, ujemajoči se imenski prostor in identiteto. Preizkus zajema baze vse svoje podatkovne spremembe povrne z rollbackom. API-preizkus zahteva pripravljene označene analitične podatke in preveri identiteto baze prek zdravja izoliranega strežnika; preverjene meritve po testu obnovi in ohrani revizijsko sled. `tests/fixtures/business-analytics-seed.ts` lahko napolni samo izolirano bazo E2E; nikoli se ne naloži iz aplikacije, namestitve sheme ali produkcijskega opravila.
