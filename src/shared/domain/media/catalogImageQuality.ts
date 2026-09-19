export const CATALOG_IMAGE_MIN_DIMENSION = 1024;

export const CATALOG_IMAGE_REVIEW_GUIDANCE = 'Uporabite 4–6 različnih uporabnih pogledov istega modela in različice, kadar so na voljo. Glavna slika naj kaže celoten izdelek od spredaj ali iz treh četrtin. Brez ljudi, obrazov ali rok. Preverite ostrino, naravne barve, oznake in sestavne dele; navedite, kateri prikazani dodatki niso vključeni. Izrezi, zrcaljenja in vrtenja iste fotografije niso novi pogledi. Ne uporabljajte povečav, praznega oblazinjenja ali pogledov, ustvarjenih z AI.';

export function assertCatalogImageDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < CATALOG_IMAGE_MIN_DIMENSION || height < CATALOG_IMAGE_MIN_DIMENSION) {
    throw new Error(`Izvirna slika mora biti široka in visoka najmanj ${CATALOG_IMAGE_MIN_DIMENSION} pik (${width || 0} × ${height || 0} pik). Povečava ali dodajanje praznega roba ne izboljšata izvirnika.`);
  }
}
