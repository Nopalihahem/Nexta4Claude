// api/gemini.js
// Vercel Serverless Function — perantara aman antara Nexta dan Gemini API
// API key TIDAK pernah keluar ke browser

export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ambil API key dari environment variable Vercel (aman, tidak terlihat di browser)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key belum dikonfigurasi di server.' });
  }

  const { mode, text, prevText, nextText } = req.body;

  // Validasi input
  if (!mode || !text) {
    return res.status(400).json({ error: 'Parameter tidak lengkap.' });
  }

  // Batas keamanan: teks maksimal 8000 karakter per request
  if (text.length > 8000) {
    return res.status(400).json({ error: 'Teks terlalu panjang.' });
  }

  // Tentukan prompt berdasarkan mode
  let prompt = '';

  if (mode === 'translate') {
    prompt = `Kamu adalah penerjemah profesional. Terjemahkan teks utama ke dalam Bahasa Indonesia yang natural, mengalir, enak dibaca layaknya novel/artikel profesional, dan tidak kaku (jangan terjemahkan kata per kata).

Konteks kalimat sebelumnya: "${prevText || ''}"
Konteks kalimat selanjutnya: "${nextText || ''}"

Teks utama yang HARUS diterjemahkan: "${text}"

Berikan HANYA hasil terjemahan dari teks utama, tanpa tanda kutip, tanpa penjelasan, dan tanpa mengulang konteks.`;

  } else if (mode === 'clean') {
    prompt = `Kamu adalah sistem pembersih teks dari hasil ekstraksi PDF.
Bersihkan teks berikut dari artefak seperti: nomor halaman, header/footer berulang, metadata dokumen, watermark, URL sumber.
Gabungkan kata yang terpotong karena hyphen di akhir baris.
Pertahankan paragraf dan struktur kalimat asli.
Kembalikan HANYA teks yang sudah bersih, tanpa komentar apapun.

Teks: ${text}`;

  } else {
    return res.status(400).json({ error: 'Mode tidak dikenal.' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: mode === 'translate' ? 0.3 : 0.1 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errData = await geminiRes.json();
      console.error('Gemini error:', errData);
      return res.status(geminiRes.status).json({ error: 'Gemini API error', detail: errData });
    }

    const data = await geminiRes.json();
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!result) {
      return res.status(500).json({ error: 'Respons kosong dari Gemini.' });
    }

    return res.status(200).json({ result });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan di server.' });
  }
}
