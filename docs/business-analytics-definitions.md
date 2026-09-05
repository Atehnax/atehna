# Poslovna analitika: podatkovne definicije

`/admin/analitika` uporablja `shared/domain/analytics/period.ts`, `statistics.ts`, `metrics.ts` in `shared/server/businessAnalytics.ts`. Zavihka Splet in Diagnostika uporabljata ločena prenovljena zbiralnika in prikaza.

## Populacije in datumi

- Aktivnost pomeni eno pravo oddano naročilo: `is_draft = false`, `deleted_at is null`, `analytics_is_test = false`. Izključeni so pretvorjeni testi `quote_requests.intake_source = 'admin_testing'`. Naročila so deduplicirana po povezanem POV, neposredna po ID naročila. Različice ponudb niso nova naročila. Preklicano naročilo ostane v aktivnosti, razen ob izrecnem filtru statusa.
- Datum aktivnosti je `analytics_submitted_at`, ki se zajame ob neposredni oddaji ali prehodu iz osnutka. Podedovani datum je `created_at`, kjer natančnejši podatek ni obnovljiv. Vrednost je originalni neto znesek blaga po popustih, brez DDV in poštnine. Pri podedovanih zapisih imajo ohranjene `order_line_snapshots` prednost pred današnjim zneskom naročila.
- Realizacija pomeni sprejeto zavezujoče naročilo (`contract_status = 'accepted'`, `commitment_status = 'binding'`) ob prvi popolni odpremi: `sent` ali `finished`. `received`, `in_progress` in `partially_sent` še niso popolna realizacija. Datum in neto znesek sta `analytics_fulfilled_at` in `analytics_fulfilled_merchandise_net`. Poznejši status `cancelled` ne odstrani zabeleženega dogodka. Neto vračilo blaga se odšteje od prvotne kohorte, ne prenese v mesec vračila. To ni obračunski prihodek in ne prejeti denar.
- Neznana zgodovina vračil je neznana: brez `refund_history_complete` in potrjenega `merchandise_refund_net` neto realizirana vrednost ostane nedostopna. Glavna kartica ne prikaže navidezno popolne vsote iz delno znanih zneskov; pokritost je navedena posebej.
- Ponudbena priložnost je en `quote_requests.id`, prvi izdani `quote_offer_versions.issued_at` in prvotna izdana neto vrednost. Sprejem pomeni prvi ohranjeni sprejem katerekoli različice, največ 30 × 24 ur po prvi izdaji. Imenovalec vsebuje samo prve izdaje v izbranem obdobju, katerih celotno okno je poteklo do `asOf`. Mlade priložnosti so ločene. Posledično lahko 30D nima nobene zrele priložnosti.
- Odzivni čas je povpraševanje → prva izdaja. Odločitveni čas je prva izdaja → prvi sprejem in je pogojen s sprejemom, tudi če je ta po 30-dnevnem oknu. Časa sta v urah.

Vsi datumi so shranjeni kot `timestamptz`/ISO UTC. Lokalni dnevi, začetki obdobij in primerjave uporabljajo `Europe/Ljubljana`. `30D`, `90D`, `180D` vključujejo današnji delni dan in predhodnih 29/89/179 lokalnih datumov. `1Y`/`2Y` začneta dan po enakem datumu pred enim/dvema letoma; 29. februar se dosledno omeji na zadnji veljaven dan meseca. YTD primerja enako pretečeno obdobje prejšnjega leta. Zaključeni prilagojeni končni datumi uporabljajo izključno mejo naslednjega lokalnega dne. DST dnevi imajo lahko 23 ali 25 ur.

Agregat ima en `asOf` ter transakcijo `repeatable read read only`; povezani kliki in izvozi prenesejo njegov referenčni čas. Ta omejuje datume dogodkov, ni mehanizem obnove že izbrisane/prepisane pretekle zbirke. Sprememba vračil lahko legitimno spremeni že prikazano kohorto. HTTP odgovori so `private, no-store`; ni skupnega predpomnilnika, ki bi preživel spremembo poslovnega zapisa ali razkril podatke drugim uporabnikom.

## Koledar aktivnosti naročil

Koledar uporablja lasten zaščiteni vir `/api/admin/analytics/business/activity` ter iste kanonične dogodke oddaje kot poslovni agregat. Obdobje določata širina prikaza in trenutni čas, ne izbira `30D`, `90D`, drugih prednastavitev ali datumov po meri. Stolpci predstavljajo tedne od ponedeljka naprej; zadnji stolpec je tekoči teden v `Europe/Ljubljana`. Prikaz sega nazaj toliko tednov, kolikor jih sprejme razpoložljiva širina z najmanj 16-pikselnimi celicami in 4-pikselnimi presledki. Na širokem namiznem zaslonu zato zajame več kot leto, na ožjem zaslonu krajšo zgodovino. Spreminjanje širine pridobi ustrezno zgodovino brez vodoravnega drsenja koledarja. Prihodnji dnevi v tekočem tednu ostanejo prazni; današnji dan je delni.

Filtri tipa naročnika, statusa in izvora naročila veljajo tudi za koledar. Sprememba obdobja drugih grafov ohrani njegove dneve, barve in referenčni `asOf`, brez nove zahteve za koledar. Klik na dan in izvoz CSV preneseta njegove lastne meje `from`/`to`, `asOf` in poslovne filtre. Tako se starejši prikazani dan odpre pravilno tudi ob izbranem 30D za druge grafe.

Število naročil ima stalne, neprekrivajoče se barvne pasove: 0 je siv, nato sledijo 1–2, 3–5, 6–10, 11–14 in 15 ali več naročil. Pozitivni pasovi napredujejo od zelene prek turkizne in modre do vijolične. Barva dneva zato ni odvisna od največjega naročila ali največje dnevne aktivnosti v trenutno vidni zgodovini. Celice imajo enostavno polno barvo, brez črtastih vzorcev. Dnevi brez razpoložljive zgodovine so prav tako sivi, vendar opis dneva in dostopna tabela ohranita razliko med manjkajočim podatkom in izmerjeno ničlo. Način vrednosti naročil uporablja pet pasov glede na največjo razpoložljivo dnevno neto vrednost; manjkajočih zneskov ne spremeni v nič.

## Zgodovinski posnetki in identiteta

Originalni tip naročnika, ime, naslov in vrednost izhajajo iz `analytics_snapshot_json`. Tipi so obstoječi `individual`, `company`, `school`; nerazpoznavni podedovani tipi ostanejo `unknown`. Današnji tip ali katalog ne prepiše novega ohranjenega posnetka. Podedovani posnetki imajo izvor `legacy`; izvirnih sprememb pred uvedbo zajema ni mogoče v celoti obnoviti.

Stabilna povezava je izrecen `school_directory_row_id` ali `customer_directory_profile_id`. Ime, e-pošta ali naslov ne združujejo šol in podružnic. Nepovezana naročila so vključena v število in vrednost naročil ter geografsko usklajevanje, vendar izključena iz koncentracije in zvestobe; njihovo število je vidno. Pred dopolnitvijo teh povezav ni mogoče sklepati o zvestobi celotne baze naročnikov.

Koncentracija, Lorenz in Gini uporabljajo nenegativno izpolnjeno vrednost blaga **pred vračili**, samo za povezane naročnike. Popravljeni neto zneski so ločen stolpec. Gini je nedoločen ob praznem naboru ali skupni vrednosti nič. Kohorte uporabljajo vso razpoložljivo zgodovino povezanega naročnika; izbrano obdobje omejuje mesec prvega nakupa. Prihodnji meseci so `null`, tekoči mesec je še nepopoln. Predhodno izgubljena zgodovina pomeni levo odrezane kohorte.

Prispevek artikla izhaja iz ohranjenih vrstic ob realizaciji (`analytics_fulfilled_lines_json`) in zgodovinskih stroškov `historical_unit_cost_net`. Podedovani fallback so ohranjene oddajne vrstice; pokritost in izvor sta razkrita. Manjkajoči stroški se ne nadomestijo z nič ali današnjim katalogom. Prispevek vključuje le strošek blaga, ne neizmerjenih drugih spremenljivih stroškov, in zato ni čisti dobiček. Vrednost/units zajema vse realizirane vrstice, prispevek na enoto le stroškovno pokriti podnabor.

## Meritve in zgodovinski preračun poštnine

`actual_packed_weight_grams`, `actual_carrier_cost_net`, `actual_parcel_count`, `actual_oversize` in `preparation_minutes` so prostovoljne dejanske meritve. Nič se ne sklepa iz starosti naročila ali mase v katalogu. Poštnina naročnika se primerja s prevoznikom šele ob potrjeni davčni osnovi (`shipping_tax_rate`/ohranjen `shippingTaxRate`); stopnja DDV artiklov ne dokazuje stopnje poštnine.

Preračun uporablja obstoječi `calculateShipping` iz `/admin/poštnina`, shranjene mere zgodovinskih vrstic, originalni bruto znesek košarice in izmerjeno število paketov. Vključuje utežne pasove, dimenzijske pogoje, popuste za pakete in vrednost naročila. To so iste pretekle košarice preračunane po trenutnih pravilih, ne napoved odziva kupcev. Izbirni `thresholdCents` spremeni samo prag omogočenih pravil popusta za vrednost v kopiji konfiguracije. Aktivnih cen ne spreminja. Manjkajoče mere ali paketi zmanjšajo pokritost, ne ustvarijo opazovanja.

## Statistika in dostop

Kvantili: tip 7, linearna interpolacija pri `(n − 1)p`. Opisna varianca deli z `n`; ločena vzorčna ocena z `n−1`. Pri eni meritvi je opisna varianca nič, vzorčna nedoločena. Korelacija in vsi regresijski statistični podatki uporabljajo isti popolni parni podnabor. Konstantni spremenljivki in singularno prileganje sta izrecno označena. OLS vključuje presek in zato, ko je korelacija določena, `R² = r²`.

Normalna in lognormalna modela sta kandidata, ne sklep o resnični porazdelitvi. Lognormalni model izloči nepozitivne vrednosti in za kandidatno aritmetično sredino uporabi `exp(logMean + logVariance/2)`. Wilsonovi 95-% intervali spremljajo opazovane stopnje. Logistični model potrebuje vsaj 30 zrelih priložnosti in vsaj 5 dogodkov vsakega izida; ločitev/singularnost/ne-konvergenca ohranijo opazovane pasovne stopnje. Binomski scenarij validira celoštevilski n/prag in `0 ≤ p ≤ 1`, računa okoli moda za stabilnost; ne potrjuje predpostavk neodvisnosti in enake verjetnosti.

Razpršeni prikazi imajo največ 600 sistematično izbranih oznak, Q–Q največ 300; vsi prikazani povzetki uporabljajo celoten veljavni nabor. Identifikatorji, iz katerih lahko odprete dejanski zapis, so samo pri prikazanih oznakah. Naslovi in celotna zbirka naročil ne gredo v odgovor agregata.

`/api/admin/analytics/business` in `/records` preverita obstoječo administratorsko sejo pred dostopom do baze. Drilldown, CSV in `/admin/orders?analytics=1` uporabljajo isti strežniški izbirnik. Izbira geografskega območja delegira istemu preverjenemu članstvu kot zemljevid, vključno s prstnim odtisom naslova in referenčno različico. Običajen `/admin/orders` ohrani prejšnje vedenje. CSV nevtralizira vnose, ki bi jih preglednica lahko izvedla kot formule.

Osnovno preverjanje: `npx tsx --test tests/unit/business-analytics.test.ts`. Datotečne pogodbe, migracije, zajem in geografske integracije imajo ločene preizkuse. Izpraznjena baza oziroma nedostopna baza ne nalaga demo podatkov; odsotne meritve ostanejo manjkajoče.

## Povzetki na seznamu naročil in ponudb

Običajni seznam naročil in tabela ponudb kažeta šest kartic za zadnjih 90 dni. Kartice so strežniška projekcija istega agregatorja kot Poslovanje, brez prenosa zgodovinskih vrstic v brskalnik. Filtri delovne tabele ne spreminjajo kartic; pod karticami je to izrecno navedeno. Klik odpre ustrezen novi pogled z istim asOf. Starih analitičnih API-jev ali preusmeritev ni več.

Naročila prikazujejo število in neto vrednost oddanih naročil, število realiziranih naročil, neto realizacijo po potrjenih vračilih ter povprečje in mediano vrednosti oddanega blaga. Ponudbe prikazujejo prve izdaje, zrele priložnosti, pravočasne sprejeme zrelih priložnosti, stopnjo sprejema ter mediano časa do izdaje in do sprejema. Osnutki brez prve izdaje niso ponudbene priložnosti. Mediana do sprejema vključuje tudi pozne sprejeme.

Noga vsake kartice uporablja zadnjih 30 dni in predhodno enako pretečeno obdobje v Ljubljani. Primerjava pred začetkom opazovane zgodovine ter odstotna sprememba ob ničelnem ali manjkajočem prejšnjem imenovalcu ostaneta nedostopni. Današnji dan je delni.
