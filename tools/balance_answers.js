// Trộn vị trí đáp án đúng trong một file đề (docs/tests/*.json) để A/B/C/D phân bố đều như đề thật.
// Đáp án đúng được chuyển tới vị trí mục tiêu, các phương án khác giữ thứ tự tương đối.
// Đồng thời cập nhật: ký hiệu (A)/(B)/(C)/(D) trong phần giải thích và lời thoại "A. …" của Part 2.
// Không đụng tới câu chèn câu (p7-insert) vì phương án là vị trí [1]–[4].
//
// Chạy: node tools/balance_answers.js docs/tests/mini-02.json [...]
const fs = require("fs");

const LETTERS = ["A", "B", "C", "D"];

function seeded(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function balance(path) {
  const test = JSON.parse(fs.readFileSync(path, "utf8"));
  const rnd = seeded(test.id);
  // Lần lượt dùng các vị trí theo vòng đã xáo, để mỗi chữ cái xuất hiện gần như bằng nhau.
  const bags = { 3: [], 4: [] };
  const take = (n) => {
    if (!bags[n].length) {
      const bag = [...Array(n).keys()];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      bags[n] = bag;
    }
    return bags[n].pop();
  };

  for (const part of test.parts) {
    for (const g of part.groups) {
      for (const q of g.questions) {
        if (q.type === "p7-insert" || q.type === "p34-graphic") continue;
        const n = q.options.length;
        const target = take(n);
        const others = q.options.map((_, i) => i).filter((i) => i !== q.answer);
        const order = others.slice();
        order.splice(target, 0, q.answer); // order[newIndex] = oldIndex
        const newOf = {};
        order.forEach((oldI, newI) => (newOf[oldI] = newI));
        q.options = order.map((i) => q.options[i]);
        q.answer = target;
        if (q.explain) q.explain = q.explain.replace(/\(([A-D])\)/g, (m, L) => `(${LETTERS[newOf[LETTERS.indexOf(L)]]})`);
        // Part 2: lời thoại có dạng "A. …" sau câu hỏi.
        if (part.part === 2 && g.script) {
          const slots = g.script.map((l, i) => [l, i]).filter(([l]) => /^[A-C]\.\s/.test(l.text));
          const texts = slots.map(([l]) => l.text.replace(/^[A-C]\.\s/, ""));
          slots.forEach(([l], newI) => (l.text = `${LETTERS[newI]}. ${texts[order[newI]]}`));
        }
      }
    }
  }
  fs.writeFileSync(path, JSON.stringify(test, null, 2) + "\n");
  const c = [0, 0, 0, 0];
  for (const p of test.parts) for (const g of p.groups) for (const q of g.questions) c[q.answer]++;
  console.log(path, "A", c[0], "B", c[1], "C", c[2], "D", c[3]);
}

for (const p of process.argv.slice(2)) balance(p);
