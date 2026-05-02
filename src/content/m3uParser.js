/**
 * ============================================================================
 * FONEX IPTV - M3U PARSER ENGINE
 * Version: 2.5.0
 * 
 * 📋 RESPONSIBILITIES:
 *   - Robust parsing of EXTM3U and EXTINF lines
 *   - Regex-based attribute extraction
 *   - Malformed data recovery
 *   - Standardized channel objects
 * ============================================================================ */

/**
 * Parses raw M3U text into an array of channel objects
 * @param {string} rawText - The raw M3U file content
 * @returns {Array<Object>} Array of standardized channel objects
 */
export const parseM3U = (rawText) => {
    if (!rawText || typeof rawText !== 'string') {
        console.warn('[M3UParser] Invalid input provided');
        return [];
    }

    const channels = [];
    const lines = rawText.split(/\r?\n/);
    let currentChannel = null;

    // Attribute Extraction Patterns
    const attrRegex = {
        id: /tvg-id="([^"]*)"/i,
        name: /tvg-name="([^"]*)"/i,
        logo: /tvg-logo="([^"]*)"/i,
        group: /group-title="([^"]*)"/i,
        groupAlt: /tvg-group="([^"]*)"/i
    };

    console.info('[M3UParser] Starting parsing of', lines.length, 'lines');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
            // Reset and start new channel detection
            currentChannel = {
                id: '',
                name: 'Unknown Channel',
                logo: '',
                category: 'Uncategorized',
                group: 'Uncategorized',
                url: ''
            };

            // 1. Extract Attributes
            const idMatch = line.match(attrRegex.id);
            const nameMatch = line.match(attrRegex.name);
            const logoMatch = line.match(attrRegex.logo);
            const groupMatch = line.match(attrRegex.group) || line.match(attrRegex.groupAlt);

            if (idMatch) currentChannel.id = idMatch[1];
            if (nameMatch) currentChannel.name = nameMatch[1];
            if (logoMatch) currentChannel.logo = logoMatch[1];
            if (groupMatch) {
                currentChannel.category = groupMatch[1];
                currentChannel.group = groupMatch[1];
            }

            // 2. Extract Display Name (after the last comma)
            const commaIndex = line.lastIndexOf(',');
            if (commaIndex !== -1) {
                const displayName = line.substring(commaIndex + 1).trim();
                if (displayName) {
                    currentChannel.name = displayName;
                }
            }
        } else if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtp')) {
            if (currentChannel) {
                currentChannel.url = line;
                // Generate a stable UID for the channel
                const channelUid = createChannelUid(currentChannel.name, currentChannel.group, currentChannel.url);
                currentChannel.uid = channelUid;
                currentChannel.id = currentChannel.id || channelUid;

                channels.push(currentChannel);
                currentChannel = null; // Reset for next detection
            }
        } else if (line.startsWith('#EXTM3U')) {
            // M3U Header - skip
            continue;
        } else if (line.startsWith('#')) {
            // Other comments or tags - skip
            continue;
        }
    }

    console.info(`[M3UParser] Successfully parsed ${channels.length} channels`);
    return channels;
};

export const m3uParser = {
    parse: parseM3U
};

export default parseM3U;

/**
 * Creates a stable unique identifier for a channel based on its metadata.
 * Useful for favorites and strategy caching when tvg-id is missing.
 */
function createChannelUid(name = '', group = '', url = '') {
    const input = `${group}|${name}|${url}`.toLowerCase().trim();
    let hash = 0;

    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }

    return `ch_${Math.abs(hash)}`;
}
