import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import DxfParser from "dxf-parser";

const DWG = "cad/FINAL DISPATCH - UPDATE.dwg";
const OUT = "data/feeders";
const DXF = "/tmp/final-dispatch.dxf";

fs.mkdirSync(OUT, { recursive: true });

console.log("========================================");
console.log("FINAL FEEDER DATABASE BUILDER");
console.log("WITH STATION MATCHING");
console.log("========================================");

if (!fs.existsSync(DWG)) {
  throw new Error(`DWG file not found: ${DWG}`);
}


// ==================================================
// CONVERT DWG -> DXF
// ==================================================

console.log("Converting DWG to DXF...");

execFileSync("dwg2dxf", ["-o", DXF, DWG], {
  stdio: "inherit"
});

if (!fs.existsSync(DXF)) {
  throw new Error("DXF conversion failed.");
}

const dxfText = fs.readFileSync(DXF, "utf8");

console.log(
  `DWG size: ${fs.statSync(DWG).size} bytes`
);

console.log(
  `DXF size: ${fs.statSync(DXF).size} bytes`
);


// ==================================================
// PARSE DXF
// ==================================================

console.log("Parsing DXF...");

const parser = new DxfParser();
const dxf = parser.parseSync(dxfText);

const entities = dxf.entities || [];

console.log(
  `DXF entities: ${entities.length}`
);


// ==================================================
// CLEAN AUTOCAD TEXT
// ==================================================

function cleanText(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  let text = String(value);

  text = text
    .replace(/\\P/gi, " ")
    .replace(/\\A\d+;/gi, "")
    .replace(/\\H[^;]+;/gi, "")
    .replace(/\\C\d+;/gi, "")
    .replace(/\\F[^;]+;/gi, "")
    .replace(/\\W[^;]+;/gi, "")
    .replace(/\\T[^;]+;/gi, "")
    .replace(/\\Q[^;]+;/gi, "")
    .replace(/\\S([^;]+);/gi, "$1")
    .replace(/[{}]/g, " ");

  return text
    .replace(/\s+/g, " ")
    .trim();
}


// ==================================================
// GET ENTITY TEXT
// ==================================================

function getEntityText(entity) {

  const values = [];

  if (typeof entity.text === "string") {
    values.push(entity.text);
  }

  if (typeof entity.textValue === "string") {
    values.push(entity.textValue);
  }

  if (typeof entity.string === "string") {
    values.push(entity.string);
  }

  if (typeof entity.value === "string") {
    values.push(entity.value);
  }

  if (typeof entity.content === "string") {
    values.push(entity.content);
  }

  if (Array.isArray(entity.text)) {
    values.push(...entity.text);
  }

  return values
    .map(cleanText)
    .filter(Boolean)
    .join(" ");
}


// ==================================================
// EXTRACT NORMAL TEXT ENTITIES
// ==================================================

const textEntities = [];

for (const entity of entities) {

  const type =
    String(entity.type || "")
      .toUpperCase();

  if (
    type !== "TEXT" &&
    type !== "MTEXT" &&
    type !== "ATTRIB" &&
    type !== "ATTDEF"
  ) {
    continue;
  }

  const text =
    getEntityText(entity);

  if (!text) {
    continue;
  }

  textEntities.push({

    type,

    text,

    layer:
      entity.layer || null,

    position:
      entity.position
        ? {
            x: entity.position.x ?? null,
            y: entity.position.y ?? null,
            z: entity.position.z ?? null
          }
        : null

  });
}

console.log(
  `Text entities: ${textEntities.length}`
);


// ==================================================
// EXTRACT RAW ATTRIB / ATTDEF FROM DXF
//
// بعض أسماء المحطات داخل الرسم قد تكون
// محفوظة كـ AutoCAD Block Attributes
// وليس TEXT أو MTEXT عادي.
// ==================================================

function extractRawAttributeEntities(dxfText) {

  const lines =
    dxfText.split(/\r?\n/);

  const results = [];

  let current = null;


  function finish() {

    if (!current) {
      return;
    }

    const text =
      cleanText(
        current.text
      );

    if (!text) {
      current = null;
      return;
    }

    results.push({

      type:
        current.type,

      text,

      layer:
        current.layer || null,

      position: {

        x:
          current.x ?? null,

        y:
          current.y ?? null,

        z:
          current.z ?? null

      }

    });

    current = null;

  }


  for (
    let i = 0;
    i < lines.length - 1;
    i += 2
  ) {

    const code =
      Number(
        String(lines[i])
          .trim()
      );

    const value =
      String(
        lines[i + 1]
      ).trim();


    // ----------------------------------------------
    // بداية Entity جديدة
    // ----------------------------------------------

    if (code === 0) {

      finish();

      if (
        value === "ATTRIB" ||
        value === "ATTDEF"
      ) {

        current = {

          type:
            value,

          text:
            "",

          layer:
            null,

          x:
            null,

          y:
            null,

          z:
            null

        };

      }

      continue;
    }


    if (!current) {
      continue;
    }


    switch (code) {


      // --------------------------------------------
      // النص الأساسي
      // --------------------------------------------

      case 1:

        current.text =
          value;

        break;


      // --------------------------------------------
      // نص إضافي
      // --------------------------------------------

      case 3:

        if (!current.text) {

          current.text =
            value;

        }
        else {

          current.text +=
            value;

        }

        break;


      // --------------------------------------------
      // Layer
      // --------------------------------------------

      case 8:

        current.layer =
          value;

        break;


      // --------------------------------------------
      // X
      // --------------------------------------------

      case 10:

        current.x =
          Number(value);

        break;


      // --------------------------------------------
      // Y
      // --------------------------------------------

      case 20:

        current.y =
          Number(value);

        break;


      // --------------------------------------------
      // Z
      // --------------------------------------------

      case 30:

        current.z =
          Number(value);

        break;

    }

  }


  finish();

  return results;
}


const rawAttributeEntities =
  extractRawAttributeEntities(
    dxfText
  );
function extractRawTextEntities(dxfText) {
  const lines = dxfText.split(/\r?\n/);
  const results = [];
  let current = null;

  function finish() {
    if (!current) return;
    const text = cleanText(current.text);
    if (!text) { current = null; return; }
    results.push({
      type: current.type,
      text,
      layer: current.layer || null,
      position: { x: current.x ?? null, y: current.y ?? null, z: current.z ?? null }
    });
    current = null;
  }

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = Number(String(lines[i]).trim());
    const value = String(lines[i + 1]).trim();
    if (code === 0) {
      finish();
      if (value === "TEXT" || value === "MTEXT" || value === "ATTRIB" || value === "ATTDEF") {
        current = { type: value, text: "", layer: null, x: null, y: null, z: null };
      }
      continue;
    }
    if (!current) continue;
    switch (code) {
      case 1: current.text += (current.text ? " " : "") + value; break;
      case 3: if (current.type === "MTEXT") current.text += value; else if (!current.text) current.text = value; break;
      case 8: current.layer = value; break;
      case 10: current.x = Number(value); break;
      case 20: current.y = Number(value); break;
      case 30: current.z = Number(value); break;
    }
  }
  finish();
  return results;
}

const rawTextEntities = extractRawTextEntities(dxfText);
console.log("Raw TEXT/MTEXT/ATTRIB/ATTDEF entities: " + rawTextEntities.length);

const existingTextKeys = new Set(
  textEntities.map(e => [e.type,e.text,e.position?.x,e.position?.y,e.layer].join("|"))
);

for (const entity of rawTextEntities) {
  const key = [entity.type,entity.text,entity.position?.x,entity.position?.y,entity.layer].join("|");
  if (!existingTextKeys.has(key)) {
    textEntities.push(entity);
    existingTextKeys.add(key);
  }
}



console.log(
  `Raw ATTRIB/ATTDEF entities: ${
    rawAttributeEntities.length
  }`
);


// ==================================================
// ADD RAW ATTRIBUTES
// ==================================================

for (
  const entity of rawAttributeEntities
) {

  if (!entity.text) {
    continue;
  }

  textEntities.push(
    entity
  );

}


console.log(
  `Total text + attributes: ${
    textEntities.length
  }`
);


// ==================================================
// FEEDER NAME DETECTION
// ==================================================

function extractFeederNames(text) {

  const results =
    new Set();

  if (!text) {
    return [];
  }

  const cleaned =
    cleanText(text);


  // ----------------------------------------------
  // F-8.13
  // F-03
  // F-2.20
  //
  // QAI.F-05
  // BSP.F-15
  // D.F-03
  // U.F-02
  // UNI.F-24
  // ----------------------------------------------

  const fPattern =
    /\b(?:[A-Z][A-Z0-9]*\.)*F\s*-\s*\d+(?:\.\d+)?\b/gi;

  for (
    const match of cleaned.matchAll(fPattern)
  ) {

    const value =
      match[0]
        .replace(/\s+/g, "")
        .toUpperCase();

    results.add(value);
  }


  // ----------------------------------------------
  // FDR#2.20
  // FDR # 2.16
  // ----------------------------------------------

  const fdrPattern =
    /\bFDR\s*#\s*\d+(?:\.\d+)?\b/gi;

  for (
    const match of cleaned.matchAll(fdrPattern)
  ) {

    const value =
      match[0]
        .replace(/\s+/g, "")
        .toUpperCase();

    results.add(value);
  }

  return [...results];
}


// ==================================================
// STATION NAME DETECTION
//
// Examples:
//
// SUB-8
// SUB 8
// SUB#8
// SUB8
// ==================================================

function extractStationNames(text) {

  const results =
    new Set();

  if (!text) {
    return [];
  }

  const cleaned =
    cleanText(text);


  // ----------------------------------------------
  // Standard station format
  // ----------------------------------------------

  const patterns = [
    /\bSUB\s*[-#]?\s*\d+\b/gi,
    /\bSUBSTATION\s*[-#]?\s*\d+\b/gi,
    /\bSUB\s*[-#]?\s*[A-Z]+\d+\b/gi,
    /\bS\s*\/\s*S\s*[-#]?\s*\d+\b/gi,
    /\bSS\s*[-#]?\s*\d+\b/gi,
    /\bGRID\s+STATION\s*#?\s*\d+\b/gi
  ];


  for (
    const pattern of patterns
  ) {

    for (
      const match of cleaned.matchAll(pattern)
    ) {

      let value =
        match[0]
          .replace(/\s+/g, "")
          .toUpperCase();


      // SUB8 -> SUB-8
      value =
        value.replace(
          /^SUB(\d+)$/i,
          "SUB-$1"
        );


      // SUB#8 -> SUB-8
      value =
        value.replace(
          /^SUB#/i,
          "SUB-"
        );


      // SUB 8 -> SUB-8
      value =
        value.replace(
          /^SUB(\d+)$/i,
          "SUB-$1"
        );


      // SUBSTATION8 -> SUBSTATION-8
      value =
        value.replace(
          /^SUBSTATION(\d+)$/i,
          "SUBSTATION-$1"
        );


      results.add(
        value
      );

    }

  }

  return [...results];
}


// ==================================================
// EXTRACT STATION LABELS
// ==================================================

const stationEntities = [];

for (
  const entity of textEntities
) {

  if (!entity.position) {
    continue;
  }

  const names =
    extractStationNames(
      entity.text
    );

  for (
    const name of names
  ) {

    stationEntities.push({

      name,

      x:
        entity.position.x,

      y:
        entity.position.y,

      z:
        entity.position.z,

      layer:
        entity.layer || null,

      type:
        entity.type

    });

  }

}


console.log(
  `Station labels: ${
    stationEntities.length
  }`
);


console.log(
  `Unique stations: ${
    new Set(
      stationEntities.map(
        item =>
          item.name
      )
    ).size
  }`
);


// ==================================================
// DISTANCE BETWEEN TWO POINTS
// ==================================================

function distance2D(a, b) {

  const dx =
    Number(a.x) -
    Number(b.x);

  const dy =
    Number(a.y) -
    Number(b.y);

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


// ==================================================
// FIND NEAREST STATION
// ==================================================

function nearestStation(position) {

  if (
    !position ||
    !stationEntities.length
  ) {

    return null;

  }


  let nearest = null;


  for (
    const station of stationEntities
  ) {

    const distance =
      distance2D(
        position,
        station
      );


    if (
      !nearest ||
      distance < nearest.distance
    ) {

      nearest = {

        name:
          station.name,

        distance,

        x:
          station.x,

        y:
          station.y,

        layer:
          station.layer || null

      };

    }

  }


  return nearest;
}


// ==================================================
// RESOLVE STATION FOR FEEDER
// ==================================================

function resolveStation(positions) {

  const matches = [];


  for (
    const position of positions || []
  ) {

    const station =
      nearestStation(
        position
      );


    if (station) {

      matches.push(
        station
      );

    }

  }


  if (!matches.length) {

    return {

      name:
        null,

      confidence:
        "unknown",

      matchCount:
        0,

      averageDistance:
        null,

      candidates:
        []

    };

  }


  // ----------------------------------------------
  // GROUP MATCHES BY STATION
  // ----------------------------------------------

  const groups =
    new Map();


  for (
    const match of matches
  ) {

    if (
      !groups.has(
        match.name
      )
    ) {

      groups.set(
        match.name,
        []
      );

    }


    groups
      .get(match.name)
      .push(match);

  }


  // ----------------------------------------------
  // RANK STATIONS
  // ----------------------------------------------

  const candidates =
    [...groups.entries()]
      .map(
        ([name, values]) => ({

          name,

          count:
            values.length,

          averageDistance:
            values.reduce(
              (sum, item) =>
                sum +
                item.distance,
              0
            ) /
            values.length,

          minDistance:
            Math.min(
              ...values.map(
                item =>
                  item.distance
              )
            )

        })
      )
      .sort(
        (a, b) =>
          b.count -
          a.count ||
          a.averageDistance -
          b.averageDistance
      );


  const best =
    candidates[0];


  const ratio =
    best.count /
    matches.length;


  let confidence =
    "low";


  if (
    ratio >= 0.75
  ) {

    confidence =
      "high";

  }
  else if (
    ratio >= 0.50
  ) {

    confidence =
      "medium";

  }


  return {

    name:
      best.name,

    confidence,

    matchCount:
      best.count,

    averageDistance:
      Number(
        best.averageDistance
          .toFixed(3)
      ),

    candidates

  };

}


// ==================================================
// BUILD FEEDER OCCURRENCES
// ==================================================

const feederMap =
  new Map();


for (
  const entity of textEntities
) {

  const names =
    extractFeederNames(
      entity.text
    );


  for (
    const name of names
  ) {

    if (
      !feederMap.has(name)
    ) {

      feederMap.set(
        name,
        {

          name,

          occurrences:
            0,

          layers:
            new Set(),

          positions:
            []

        }
      );

    }


    const feeder =
      feederMap.get(
        name
      );


    feeder.occurrences++;


    if (entity.layer) {

      feeder.layers.add(
        entity.layer
      );

    }


    if (entity.position) {

      feeder.positions.push({

        x:
          entity.position.x,

        y:
          entity.position.y,

        z:
          entity.position.z,

        layer:
          entity.layer || null,

        type:
          entity.type

      });

    }

  }

}


// ==================================================
// BUILD FINAL FEEDER DATABASE
// ==================================================

const feeders =
  [...feederMap.values()]
    .map(
      feeder => {

        const station =
          resolveStation(
            feeder.positions
          );


        return {

          name:
            feeder.name,

          station:
            station.name,

          stationConfidence:
            station.confidence,

          stationMatchCount:
            station.matchCount,

          stationAverageDistance:
            station.averageDistance,

          stationCandidates:
            station.candidates,

          occurrences:
            feeder.occurrences,

          layers:
            [...feeder.layers]
              .sort(),

          positions:
            feeder.positions

        };

      }
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        )
    );


// ==================================================
// SIMPLE FEEDER NAME LIST
// ==================================================

const feederNames =
  feeders.map(
    feeder =>
      feeder.name
  );


// ==================================================
// FEEDER CATEGORIES
// ==================================================

const prefixStats = {};


for (
  const feeder of feeders
) {

  let category =
    "F";


  if (
    feeder.name
      .startsWith("FDR#")
  ) {

    category =
      "FDR";

  }
  else if (
    feeder.name
      .includes(".F-")
  ) {

    category =
      "PREFIX.F";

  }


  prefixStats[category] =
    (
      prefixStats[category] ||
      0
    ) + 1;

}


// ==================================================
// STATION -> FEEDERS MAP
// ==================================================

const stationMap = {};


for (
  const feeder of feeders
) {

  if (!feeder.station) {
    continue;
  }


  if (
    !stationMap[
      feeder.station
    ]
  ) {

    stationMap[
      feeder.station
    ] = [];

  }


  stationMap[
    feeder.station
  ].push(
    feeder.name
  );

}


for (
  const station of
  Object.keys(stationMap)
) {

  stationMap[
    station
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity: "base"
        }
      )
  );

}


// ==================================================
// UNIQUE STATION LIST
// ==================================================

const stationNames =
  [
    ...new Set(
      stationEntities.map(
        item =>
          item.name
      )
    )
  ]
  .sort(
    (a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity: "base"
        }
      )
  );


// ==================================================
// MATCHING STATISTICS
// ==================================================

const matchedFeeders =
  feeders.filter(
    feeder =>
      feeder.station
  ).length;


const unmatchedFeeders =
  feeders.length -
  matchedFeeders;


const highConfidence =
  feeders.filter(
    feeder =>
      feeder.stationConfidence ===
      "high"
  ).length;


const mediumConfidence =
  feeders.filter(
    feeder =>
      feeder.stationConfidence ===
      "medium"
  ).length;


const lowConfidence =
  feeders.filter(
    feeder =>
      feeder.stationConfidence ===
      "low"
  ).length;


// ==================================================
// MANIFEST
// ==================================================

const manifest = {

  source:
    DWG,

  generatedAt:
    new Date().toISOString(),

  dwgBytes:
    fs.statSync(DWG).size,

  dxfBytes:
    fs.statSync(DXF).size,

  dxfEntities:
    entities.length,

  textEntities:
    textEntities.length,

  totalFeeders:
    feeders.length,

  stationLabels:
    stationEntities.length,

  totalStations:
    stationNames.length,

  matchedFeeders,

  unmatchedFeeders,

  confidence: {

    high:
      highConfidence,

    medium:
      mediumConfidence,

    low:
      lowConfidence

  },

  categories:
    prefixStats,

  stations:
    stationNames,

  description:
    "Feeder database extracted directly from the DWG with spatial station matching and raw AutoCAD attribute extraction."

};


// ==================================================
// SAVE FEEDERS.JSON
// ==================================================

console.log("");
console.log("Writing feeder database...");


fs.writeFileSync(

  path.join(
    OUT,
    "feeders.json"
  ),

  JSON.stringify(
    feeders,
    null,
    2
  ),

  "utf8"

);


// ==================================================
// SAVE FEEDER NAMES
// ==================================================

fs.writeFileSync(

  path.join(
    OUT,
    "feeder_names.json"
  ),

  JSON.stringify(
    feederNames,
    null,
    2
  ),

  "utf8"

);


// ==================================================
// SAVE MANIFEST
// ==================================================

fs.writeFileSync(

  path.join(
    OUT,
    "manifest.json"
  ),

  JSON.stringify(
    manifest,
    null,
    2
  ),

  "utf8"

);


// ==================================================
// SAVE ALL TEXT ENTITIES
// ==================================================

fs.writeFileSync(

  path.join(
    OUT,
    "all_text_entities.json"
  ),

  JSON.stringify(
    textEntities,
    null,
    2
  ),

  "utf8"

);


// ==================================================
// SAVE STATIONS
// ==================================================

fs.writeFileSync(

  path.join(
    OUT,
    "stations.json"
  ),

  JSON.stringify(
    stationEntities,
    null,
    2
  ),

  "utf8"

);


// ==================================================
// SAVE STATION -> FEEDERS
// ==================================================

fs.writeFileSync(

  path.join(
    OUT,
    "station_feeders.json"
  ),

  JSON.stringify(
    stationMap,
    null,
    2
  ),

  "utf8"

);


// ==================================================
// CONSOLE RESULTS
// ==================================================

console.log("");

console.log(
  "========================================"
);

console.log(
  "FEEDER DATABASE RESULT"
);

console.log(
  "========================================"
);


console.log(
  `Total feeders: ${
    feeders.length
  }`
);


console.log(
  `Total stations: ${
    stationNames.length
  }`
);


console.log(
  `Station labels: ${
    stationEntities.length
  }`
);


console.log(
  `Matched feeders: ${
    matchedFeeders
  }`
);


console.log(
  `Unmatched feeders: ${
    unmatchedFeeders
  }`
);


console.log("");

console.log(
  "Confidence:"
);


console.log(
  `High: ${
    highConfidence
  }`
);


console.log(
  `Medium: ${
    mediumConfidence
  }`
);


console.log(
  `Low: ${
    lowConfidence
  }`
);


console.log("");

console.log(
  "Categories:"
);


console.log(
  JSON.stringify(
    prefixStats,
    null,
    2
  )
);


console.log("");

console.log(
  "FEEDER → STATION:"
);


console.log(
  "----------------------------------------"
);


for (
  const feeder of feeders
) {

  console.log(

    `${feeder.name} → ${
      feeder.station ||
      "UNMATCHED"
    } | confidence: ${
      feeder.stationConfidence
    } | occurrences: ${
      feeder.occurrences
    }`

  );

}


console.log("");

console.log(
  "========================================"
);

console.log(
  "FEEDER DATABASE BUILD COMPLETED"
);

console.log(
  "========================================"
);


// ==================================================
// CLEANUP
// ==================================================

try {

  fs.unlinkSync(
    DXF
  );

}
catch {

  // Ignore cleanup errors.

}
