const fs = require('fs');

async function fetchSprite() {
  try {
    const url = 'https://openclipart.org/search/json/?query=spiderman';
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.payload && data.payload.length > 0) {
      // Find a suitable PNG URL
      const imgUrl = data.payload[0].svg.png_2000px || data.payload[0].svg.png_thumb || data.payload[0].svg.url;
      console.log('Found OpenClipart URL:', imgUrl);
      
      const imgRes = await fetch(imgUrl);
      const buffer = await imgRes.arrayBuffer();
      fs.writeFileSync('./static/spidey.png', Buffer.from(buffer));
      console.log('Successfully saved to static/spidey.png');
    } else {
      console.log('No images found on OpenClipart.');
    }
  } catch (err) {
    console.error('Error fetching sprite:', err);
  }
}

fetchSprite();
