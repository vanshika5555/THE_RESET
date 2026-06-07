const express = require('express');
const router  = express.Router();

// POST /api/style/analyse
router.post('/analyse', async (req, res) => {
  const { gender, skinTone, eyeColor, hairColor, bodyType, occasion } = req.body;

  const prompt = `You are a professional fashion stylist for THE RESET, a monochrome black and white fashion brand.

A customer has shared their appearance details:
- Shopping for: ${gender}'s clothing
- Skin tone: ${skinTone}
- Eye color: ${eyeColor}
- Hair color: ${hairColor}
- Body type: ${bodyType}
- Occasion: ${occasion}

THE RESET sells only black and white clothing. Please provide:

1. **Why Black & White Works For You** - explain specifically how their features complement monochrome fashion
2. **Best Shades** - which shades of black and white (pure white, off-white, cream, charcoal, jet black, etc.) suit them most and why
3. **Recommended Silhouettes** - 3-4 specific clothing styles/cuts that flatter their body type and suit the occasion
4. **Styling Tips** - 3 practical tips on how to wear black and white effectively for their features
5. **Complete Outfit Suggestion** - one complete head-to-toe outfit from THE RESET's style
6. **What to Avoid** - 2 things to avoid

Be warm, specific and encouraging. Format with clear sections using the bold headers above. Keep each section concise. Speak directly to the customer as "you".`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    if (!text) return res.status(500).json({ message: 'No response from AI' });
    res.json({ result: text });
  } catch (err) {
    console.error('Style analyser error:', err);
    res.status(500).json({ message: 'AI request failed' });
  }
});

module.exports = router;