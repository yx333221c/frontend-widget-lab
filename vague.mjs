import fs from "node:fs";
const words = ["提升体验","更自然","自然","高级感","高级","优雅","好看","漂亮","舒服","精致","质感","沉浸","仪式感","更好","更佳","大幅","极大","无疑","显然","明显","掉价","讨巧","有劲","白捡","廉价","反人类","最省事","天生","省力","省事","贵","性价比"];
for (const id of ["spotlight-card","drag-snap-cards","rubber-band-list","long-press-menu"]) {
  const f = `docs/interaction/${id}.md`;
  const raw = fs.readFileSync(f, "utf8");
  const prose = raw.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const hits = [];
  words.forEach(w => {
    let i = -1;
    while ((i = prose.indexOf(w, i + 1)) !== -1) {
      const s = Math.max(0, i - 40);
      hits.push(`   [${w}] …${prose.slice(s, i + w.length + 40).replace(/\s+/g, " ")}…`);
    }
  });
  console.log(`\n===== ${id}  (${hits.length})`);
  hits.forEach(h => console.log(h));
}
