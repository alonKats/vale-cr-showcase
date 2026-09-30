#!/usr/bin/env python3
"""Writes the synthetic retailer pages under fixtures/<retailer>/<category>/.

Every product, price, model number and barcode below is INVENTED. The two
retailers do not exist and their hosts cannot resolve. The point of the set is
to exercise each path of the pipeline on a small, readable input:

  · the same model number at both shops           -> Tier 1b (model stem)
  · the same barcode at both shops                 -> Tier 1a (EAN)
  · no model number anywhere, one candidate pair   -> Tier 2 (spec fingerprint)
  · one SKU listed once per colour at one shop     -> variant collapse
  · an accessory that shares the category's words  -> the keep/drop filter
  · a product only one shop carries                -> a `solo` card
  · a gap large enough for the featured slot, an exact match behind it

    python3 fixtures/generate.py      (from engine/)
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
HOSTS = {"norte": "https://norte.example", "sur": "https://sur.example"}
NAMES = {"norte": "Tienda Norte", "sur": "Tienda Sur"}

# (category, retailer, title, price, brand, mpn, gtin13, list_price)
ROWS = [
    # ---- microondas ------------------------------------------------------
    ("microondas", "norte", "Microondas Samsung 0.8 pies 800W de mostrador negro MS23K3513AK", 74900, "Samsung", "MS23K3513AK", None, 89900),
    ("microondas", "sur",   "Horno Microondas Samsung MS23K3513AK 0.8 pies 800 W negro", 69900, "Samsung", "MS23K3513AK", None, None),
    ("microondas", "norte", "Microondas Whirlpool 0.7 pies 700 W de mostrador blanco WM1807B", 59900, "Whirlpool", "WM1807B", None, None),
    ("microondas", "sur",   "Microondas Whirlpool WM1807B 0.7 pies blanco 700W", 79900, "Whirlpool", "WM1807B", None, None),
    ("microondas", "norte", "Microondas LG NeoChef 0.9 pies 1000W acero inoxidable", 129900, "LG", None, "8806091234567", None),
    ("microondas", "sur",   "Microondas LG NeoChef 0.9 pies inox 1000 W", 109900, "LG", None, "8806091234567", 119900),
    ("microondas", "norte", "Microondas Panasonic 1.2 pies 1200W inverter acero inoxidable NN-SB458S", 99900, "Panasonic", "NN-SB458S", None, None),
    ("microondas", "norte", "Microondas Mabe 1.1 pies con extractor acero inoxidable 1000 W", 249900, "Mabe", None, None, None),
    ("microondas", "sur",   "Microondas Mabe 1.1 pies over the range inox 1000W", 219900, "Mabe", None, None, None),
    ("microondas", "sur",   "Microondas Frigidaire 1.1 pies 1100W de mostrador acero FFCM1155US", 89900, "Frigidaire", "FFCM1155US", None, None),
    ("microondas", "sur",   "Microondas Samsung 2.1 pies 1000W con extractor negro ME21A7013AT", 139900, "Samsung", "ME21A7013AT", None, None),
    ("microondas", "sur",   "Microondas Samsung 2.1 pies 1000W con extractor acero inoxidable ME21A7013AT", 149900, "Samsung", "ME21A7013AT", None, None),
    ("microondas", "norte", "Microondas Samsung 2.1 pies 1000W con extractor acero inoxidable ME21A7013AT", 159900, "Samsung", "ME21A7013AT", None, None),
    ("microondas", "norte", "Plato giratorio para microondas 27 cm", 8900, None, None, None, None),
    # ---- refrigeradoras --------------------------------------------------
    ("refrigeradoras", "norte", "Refrigeradora Samsung Side by Side 27 pies acero inoxidable RS27T5200S9", 899900, "Samsung", "RS27T5200S9", None, None),
    ("refrigeradoras", "sur",   "Refrigeradora Samsung RS27T5200S9 side by side 27 pies inox", 1049900, "Samsung", "RS27T5200S9", None, 1149900),
    ("refrigeradoras", "norte", "Refrigeradora LG Top Freezer 15 pies plateada LT57BPSX", 449900, "LG", "LT57BPSX", None, None),
    ("refrigeradoras", "sur",   "Refrigeradora LG LT57BPSX 15 pies congelador superior plateada", 379900, "LG", "LT57BPSX", None, None),
    ("refrigeradoras", "norte", "Refrigeradora Whirlpool Side by Side 25 pies acero inoxidable WRS315SDHM", 749900, "Whirlpool", "WRS315SDHM", None, None),
    ("refrigeradoras", "norte", "Refrigeradora Mabe 10 pies dos puertas gris RMA250FYMRS0", 289900, "Mabe", "RMA250FYMRS0", None, None),
    ("refrigeradoras", "sur",   "Refrigeradora Mabe RMA250FYMRS0 10 pies 2 puertas grafito", 289900, "Mabe", "RMA250FYMRS0", None, None),
    ("refrigeradoras", "sur",   "Refrigeradora Frigidaire French Door 26 pies acero inoxidable FRSS2623AS", 969900, "Frigidaire", "FRSS2623AS", None, None),
    ("refrigeradoras", "norte", "Refrigeradora Whirlpool French Door 20 pies acero inoxidable", 1199900, "Whirlpool", None, "7891234567895", None),
    ("refrigeradoras", "sur",   "Refrigeradora Whirlpool 20 pies french door inox", 1099900, "Whirlpool", None, "7891234567895", None),
    ("refrigeradoras", "norte", "Refrigeradora Hisense 18 pies bottom freezer acero", 429900, "Hisense", None, None, None),
    ("refrigeradoras", "sur",   "Refrigeradora Hisense 18 pies congelador inferior inox", 409900, "Hisense", None, None, None),
    ("refrigeradoras", "sur",   "Filtro de agua para refrigeradora Samsung", 24900, "Samsung", None, None, None),
    # ---- pantallas -------------------------------------------------------
    ("pantallas", "norte", "Pantalla Samsung 55 pulgadas QLED 4K Tizen QN55Q60DAPXPA", 449900, "Samsung", "QN55Q60DAPXPA", None, 499900),
    ("pantallas", "sur",   "Smart TV Samsung QN55Q60DAPXPA 55 QLED 4K", 399900, "Samsung", "QN55Q60DAPXPA", None, None),
    ("pantallas", "norte", "Televisor LG 65 pulgadas LED 4K webOS 65UT8050PSB", 549900, "LG", "65UT8050PSB", None, None),
    ("pantallas", "sur",   "Pantalla LG 65UT8050PSB 65 pulgadas UHD 4K webOS", 699900, "LG", "65UT8050PSB", None, None),
    ("pantallas", "sur",   "Pantalla TCL 43 pulgadas LED FHD Android TV 43S5400A", 169900, "TCL", "43S5400A", None, None),
    ("pantallas", "norte", "Televisor Sony 55 pulgadas LED 4K Google TV KD-55X77L", 599900, "Sony", "KD-55X77L", None, None),
    ("pantallas", "sur",   "Pantalla Sony KD-55X77L 55 pulgadas 4K Google TV", 579900, "Sony", "KD-55X77L", None, None),
    ("pantallas", "norte", "Pantalla Hisense 50 pulgadas LED 4K VIDAA 50A6K", 259900, "Hisense", "50A6K", None, None),
    ("pantallas", "norte", "Pantalla Xiaomi 43 pulgadas LED 4K Google TV", 219900, "Xiaomi", None, None, None),
    ("pantallas", "sur",   "Smart TV Xiaomi 43 pulgadas 4K LED Google TV", 199900, "Xiaomi", None, None, None),
    ("pantallas", "norte", "Soporte de pared para pantalla 32 a 70 pulgadas", 14900, None, None, None, None),
    # ---- celulares -------------------------------------------------------
    ("celulares", "norte", "Celular Samsung Galaxy S25 Ultra 12GB RAM 256GB 5G Negro", 899900, "Samsung", None, None, 999900),
    ("celulares", "sur",   "Celular Samsung Galaxy S25 Ultra 5G 12GB RAM 256GB Titanio", 949900, "Samsung", None, None, None),
    ("celulares", "norte", "Celular Apple iPhone 16 8GB RAM 128GB de almacenamiento Negro", 549900, "Apple", None, None, None),
    ("celulares", "norte", "Celular Apple iPhone 16 8GB RAM 128GB de almacenamiento Azul", 549900, "Apple", None, None, None),
    ("celulares", "norte", "Celular Apple iPhone 16 8GB RAM 128GB de almacenamiento Blanco", 569900, "Apple", None, None, None),
    ("celulares", "sur",   "Celular Apple iPhone 16 8GB RAM 128GB de almacenamiento Verde", 529900, "Apple", None, None, None),
    ("celulares", "norte", "Celular Xiaomi Redmi Note 14 8GB RAM 256GB 4G Azul", 129900, "Xiaomi", None, None, None),
    ("celulares", "sur",   "Celular Xiaomi Redmi Note 14 4G 8GB RAM 256GB Negro", 159900, "Xiaomi", None, None, None),
    ("celulares", "sur",   "Celular Motorola Moto G85 5G 8GB RAM 256GB Gris", 199900, "Motorola", None, None, None),
    ("celulares", "norte", "Celular Samsung Galaxy A16 4GB RAM 128GB 4G Negro", 99900, "Samsung", None, "8806095551234", None),
    ("celulares", "sur",   "Celular Samsung Galaxy A16 4G 4GB RAM 128GB Negro", 129900, "Samsung", None, "8806095551234", None),
    ("celulares", "norte", "Cargador Samsung 25W USB-C para celular", 12900, "Samsung", None, None, None),
]

PAGE = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{title} | {shop}</title>
<script type="application/ld+json">{ld}</script>
</head>
<body>
<h1>{title}</h1>
<p>Precio: ₡{price}</p>
<p>Página sintética de ejemplo. {shop} no es una tienda real.</p>
</body>
</html>
"""


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    for d in (HERE / "norte", HERE / "sur"):
        for f in d.rglob("*.html"):
            f.unlink()
    counter = {}
    for cat, shop, title, price, brand, mpn, gtin, list_price in ROWS:
        s = slug(title)
        counter[(shop, s)] = counter.get((shop, s), 0) + 1
        if counter[(shop, s)] > 1:
            s = f"{s}-{counter[(shop, s)]}"
        url = f"{HOSTS[shop]}/p/{s}"
        offer = {"@type": "Offer", "url": url, "price": f"{price}.00",
                 "priceCurrency": "CRC", "availability": "https://schema.org/InStock"}
        if list_price:
            offer["priceSpecification"] = [{"@type": "UnitPriceSpecification",
                                            "priceType": "https://schema.org/ListPrice",
                                            "price": f"{list_price}.00"}]
        ld = {"@context": "https://schema.org", "@type": "Product", "name": title,
              "sku": f"{shop.upper()}-{abs(hash(title)) % 100000:05d}", "url": url,
              "offers": offer}
        if brand:
            ld["brand"] = {"@type": "Brand", "name": brand}
        if mpn:
            ld["mpn"] = mpn
        if gtin:
            ld["gtin13"] = gtin
        out = HERE / shop / cat / f"{s}.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(PAGE.format(title=title, shop=NAMES[shop], price=f"{price:,}".replace(",", "."),
                                   ld=json.dumps(ld, ensure_ascii=False)), encoding="utf-8")
    print(f"{len(ROWS)} pages written")


if __name__ == "__main__":
    main()
