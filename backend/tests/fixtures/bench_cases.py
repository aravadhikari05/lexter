"""
Ground-truth cases for benchmarking (web-search verified).

Each case uses a sparse input (just the case name).
Expected fields are the verified correct citation components.
"""

CASES = [
    {
        "id": "tiano",
        "input": "Tiano v. Dillard Department Stores, Inc.",
        "expected": {
            "volume": "139",
            "reporter": "F.3d",
            "firstPage": "679",
            "court": "9th Cir.",
            "year": "1998",
        },
    },
    {
        "id": "pottenger",
        "input": "Pottenger v. Potlatch Corp.",
        "expected": {
            "volume": "329",
            "reporter": "F.3d",
            "firstPage": "740",
            "court": "9th Cir.",
            "year": "2003",
        },
    },
    {
        "id": "raniola",
        "input": "Raniola v. Bratton",
        "expected": {
            "volume": "243",
            "reporter": "F.3d",
            "firstPage": "610",
            "court": "2d Cir.",
            "year": "2001",
        },
    },
    {
        "id": "lentini",
        "input": "Lentini v. California Center for the Arts, Escondido",
        "expected": {
            "volume": "370",
            "reporter": "F.3d",
            "firstPage": "837",
            "court": "9th Cir.",
            "year": "2004",
        },
    },
    {
        "id": "bruso",
        "input": "Bruso v. United Airlines, Inc.",
        "expected": {
            "volume": "239",
            "reporter": "F.3d",
            "firstPage": "848",
            "court": "7th Cir.",
            "year": "2001",
        },
    },
    {
        "id": "zubulake",
        "input": "Zubulake v. UBS Warburg LLC",
        "expected": {
            "volume": "217",
            "reporter": "F.R.D.",
            "firstPage": "309",
            "court": "S.D.N.Y.",
            "year": "2003",
        },
    },
    {
        "id": "stout",
        "input": "Stout v. Baxter Healthcare Corp.",
        "expected": {
            "volume": "282",
            "reporter": "F.3d",
            "firstPage": "856",
            "court": "5th Cir.",
            "year": "2002",
        },
    },
    {
        "id": "nissan_fire",
        "input": "Nissan Fire & Marine Insurance Co. v. Fritz Companies, Inc.",
        "expected": {
            "volume": "210",
            "reporter": "F.3d",
            "firstPage": "1099",
            "court": "9th Cir.",
            "year": "2000",
        },
    },
    {
        "id": "swierkiewicz",
        "input": "Swierkiewicz v. Sorema N.A.",
        "expected": {
            "volume": "534",
            "reporter": "U.S.",
            "firstPage": "506",
            "court": "",  # SCOTUS — no court parenthetical
            "year": "2002",
        },
    },
    {
        "id": "colwell",
        "input": "Colwell v. Suffolk County Police Department",
        "expected": {
            "volume": "158",
            "reporter": "F.3d",
            "firstPage": "635",
            "court": "2d Cir.",
            "year": "1998",
        },
    },
]

CHECKED_FIELDS = ("volume", "reporter", "firstPage", "court", "year")
