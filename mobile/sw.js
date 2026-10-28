// Service worker: guarda os arquivos do app para funcionar sem internet.
// Ao mudar algum arquivo, aumente a versão para os celulares baixarem a nova.
const CACHE = "planner-saudavel-v5";
const ARQUIVOS = ["./", "index.html", "estilo.css", "app.js", "dados.js", "manifest.webmanifest", "icone.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Rede primeiro (pega atualizações quando há internet); sem internet, usa a cópia guardada
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return resp; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
