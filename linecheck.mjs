import fs from "node:fs";
const id = process.argv[2], cat = process.argv[3];
const doc = fs.readFileSync(`docs/${cat}/${id}.md`, "utf8");
const html = fs.readFileSync(`widgets/${cat}/${id}.html`, "utf8");
const H = html.split("\n").map(s => s.replace(/\s+/g, " ").trim());
const lines = [...doc.matchAll(/```\w+\n([\s\S]*?)```/g)].flatMap(m =>
  m[1].split("\n").map(l => l.replace(/[\s\u3000]+/g, " ").trim()));
const missing = lines.filter(l => l && !H.some(h => h === l || h.includes(l)));
console.log(`${id}: ${lines.length} doc lines, ${missing.length} not found in component`);
missing.forEach(l => console.log("   " + l.slice(0, 95)));
