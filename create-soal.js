import { requireAuth } from "./auth.js";
import { COST_CREATE_QUESTION_SET } from "./firebase-config.js";
import { createQuestionSet } from "./questions.js";

document.getElementById("costLabel").textContent = COST_CREATE_QUESTION_SET;

let currentUid = null, currentUsername = null, isAdmin = false;
let currentType = "tebak-kata";
let itemCount = 0;

requireAuth((user, ref, data) => {
  currentUid = user.uid;
  currentUsername = data.username;
  isAdmin = !!data.isAdmin;
  document.getElementById("pointsVal").textContent = data.points || 0;
  addItem();
  addItem();
});

document.querySelectorAll("#typeTabs .tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#typeTabs .tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
    document.getElementById("itemsWrap").innerHTML = "";
    itemCount = 0;
    addItem(); addItem();
  });
});

document.getElementById("addItemBtn").addEventListener("click", addItem);

function addItem() {
  itemCount++;
  const id = "item_" + itemCount;
  const wrap = document.getElementById("itemsWrap");
  const box = document.createElement("div");
  box.className = "card";
  box.style.marginTop = "16px";
  box.style.padding = "16px";
  box.dataset.itemId = id;

  if (currentType === "kuis-tim") {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between;"><strong>Soal #${itemCount}</strong>
        <button type="button" class="btn btn-sm btn-ghost remove-btn">Hapus</button></div>
      <label>Pertanyaan</label>
      <input type="text" class="q-text" placeholder="Ibukota Indonesia?">
      <label>Pilihan Jawaban (centang yang benar)</label>
      ${[0,1,2,3].map(i => `
        <div class="field-row" style="align-items:center; margin-top:8px;">
          <input type="radio" name="correct_${id}" value="${i}" ${i===0?"checked":""} style="width:auto;">
          <input type="text" class="opt-text" placeholder="Pilihan ${i+1}">
        </div>`).join("")}
    `;
  } else if (currentType === "tebak-gambar") {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between;"><strong>Soal #${itemCount}</strong>
        <button type="button" class="btn btn-sm btn-ghost remove-btn">Hapus</button></div>
      <label>URL Gambar</label>
      <input type="url" class="q-image" placeholder="https://...">
      <label>Petunjuk tambahan (opsional)</label>
      <input type="text" class="q-text" placeholder="misal: Hewan berkaki empat">
      <label>Jawaban benar</label>
      <input type="text" class="q-answer" placeholder="misal: kucing (bisa banyak alternatif, pisah pakai | )">
    `;
  } else {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between;"><strong>Soal #${itemCount}</strong>
        <button type="button" class="btn btn-sm btn-ghost remove-btn">Hapus</button></div>
      <label>Pertanyaan / Petunjuk</label>
      <input type="text" class="q-text" placeholder="misal: Ibukota Jepang">
      <label>Jawaban benar</label>
      <input type="text" class="q-answer" placeholder="misal: tokyo (bisa banyak alternatif, pisah pakai | )">
    `;
  }
  wrap.appendChild(box);
  box.querySelector(".remove-btn").addEventListener("click", () => box.remove());
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("errMsg");
  const okEl = document.getElementById("okMsg");
  errEl.style.display = "none"; okEl.style.display = "none";

  const title = document.getElementById("title").value;
  const boxes = [...document.querySelectorAll("#itemsWrap > .card")];
  const items = [];

  for (const box of boxes) {
    if (currentType === "kuis-tim") {
      const question = box.querySelector(".q-text").value.trim();
      const opts = [...box.querySelectorAll(".opt-text")].map(i => i.value.trim());
      const correctRadio = box.querySelector(`input[type=radio]:checked`);
      if (!question || opts.some(o => !o)) continue;
      items.push({ question, options: opts, correctIndex: Number(correctRadio.value) });
    } else if (currentType === "tebak-gambar") {
      const imageUrl = box.querySelector(".q-image").value.trim();
      const question = box.querySelector(".q-text").value.trim();
      const answer = box.querySelector(".q-answer").value.trim();
      if (!imageUrl || !answer) continue;
      items.push({ imageUrl, question, answer });
    } else {
      const question = box.querySelector(".q-text").value.trim();
      const answer = box.querySelector(".q-answer").value.trim();
      if (!question || !answer) continue;
      items.push({ question, answer });
    }
  }

  if (!items.length) {
    errEl.textContent = "Isi minimal 1 soal dengan lengkap.";
    errEl.style.display = "block";
    return;
  }

  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true; saveBtn.textContent = "Menyimpan...";
  try {
    await createQuestionSet(currentUid, currentUsername, title || (currentType + " set"), currentType, items, isAdmin);
    okEl.textContent = "Set soal berhasil disimpan! Mengarahkan ke dashboard...";
    okEl.style.display = "block";
    setTimeout(() => window.location.href = "dashboard.html", 1200);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "block";
    saveBtn.disabled = false; saveBtn.textContent = "Simpan Set Soal";
  }
});
