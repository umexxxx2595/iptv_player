/**
 * Background M3U Parser Worker - Performance & Progress Edition
 */

self.onmessage = async (e) => {
    const { url } = e.data;
    
    const proxies = [
        '',
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest='
    ];

    let lastError = '';
    
    for (const proxy of proxies) {
        try {
            const targetUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
            
            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const text = await response.text();
            if (!text || text.length < 20) throw new Error('Invalid Data');

            const playlist = [];
            const lines = text.split(/\r?\n/);
            let currentItem = null;

            for (let i = 0; i < lines.length; i++) {
                // Send progress every 1000 lines
                if (i % 1000 === 0) {
                    self.postMessage({ type: 'PROGRESS', percent: Math.round((i / lines.length) * 100) });
                }

                const line = lines[i].trim();
                if (!line || line === '#EXTM3U') continue;

                if (line.startsWith('#EXTINF:')) {
                    const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
                    const groupMatch = line.match(/group-title="([^"]+)"/i);
                    const nameMatch = line.match(/,(.*)$/);

                    currentItem = {
                        name: nameMatch ? nameMatch[1].trim() : 'Channel',
                        logo: logoMatch ? logoMatch[1] : '',
                        group: groupMatch ? groupMatch[1] : 'General',
                        url: ''
                    };
                } else if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtp')) {
                    if (currentItem) {
                        currentItem.url = line;
                        playlist.push(currentItem);
                        currentItem = null;
                    }
                }
            }

            self.postMessage({ type: 'SUCCESS', playlist });
            return; 
        } catch (error) {
            lastError = error.message;
        }
    }

    self.postMessage({ type: 'ERROR', error: lastError });
};
