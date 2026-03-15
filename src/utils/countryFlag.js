// Maps Discogs country name strings → ISO 3166-1 alpha-2 codes
const COUNTRY_TO_ISO = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR',
  'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
  'Belarus': 'BY', 'Belgium': 'BE', 'Bolivia': 'BO', 'Bosnia': 'BA',
  'Brazil': 'BR', 'Bulgaria': 'BG', 'Canada': 'CA', 'Chile': 'CL',
  'China': 'CN', 'Colombia': 'CO', 'Croatia': 'HR', 'Cuba': 'CU',
  'Cyprus': 'CY', 'Czech Republic': 'CZ', 'Czechia': 'CZ',
  'Denmark': 'DK', 'Ecuador': 'EC', 'Egypt': 'EG', 'Estonia': 'EE',
  'Europe': 'EU', 'Finland': 'FI', 'France': 'FR', 'Georgia': 'GE',
  'Germany': 'DE', 'Greece': 'GR', 'Hong Kong': 'HK', 'Hungary': 'HU',
  'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR',
  'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT',
  'Jamaica': 'JM', 'Japan': 'JP', 'Jordan': 'JO', 'Kazakhstan': 'KZ',
  'Kenya': 'KE', 'Latvia': 'LV', 'Lebanon': 'LB', 'Lithuania': 'LT',
  'Luxembourg': 'LU', 'Malaysia': 'MY', 'Malta': 'MT', 'Mexico': 'MX',
  'Moldova': 'MD', 'Morocco': 'MA', 'Netherlands': 'NL',
  'New Zealand': 'NZ', 'Nigeria': 'NG', 'North Macedonia': 'MK',
  'Norway': 'NO', 'Pakistan': 'PK', 'Peru': 'PE', 'Philippines': 'PH',
  'Poland': 'PL', 'Portugal': 'PT', 'Romania': 'RO', 'Russia': 'RU',
  'Saudi Arabia': 'SA', 'Scotland': 'GB', 'Serbia': 'RS',
  'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI',
  'South Africa': 'ZA', 'South Korea': 'KR', 'Korea': 'KR',
  'Spain': 'ES', 'Sweden': 'SE', 'Switzerland': 'CH', 'Taiwan': 'TW',
  'Thailand': 'TH', 'Tunisia': 'TN', 'Turkey': 'TR', 'Türkiye': 'TR',
  'UK': 'GB', 'Ukraine': 'UA', 'Uruguay': 'UY', 'US': 'US', 'USA': 'US',
  'United Kingdom': 'GB', 'United States': 'US',
  'Venezuela': 'VE', 'Vietnam': 'VN',
}

/** Convert an ISO 3166-1 alpha-2 code to its flag emoji. */
function isoToFlag(iso) {
  if (!iso || iso.length !== 2) return ''
  const base = 0x1F1E6 - 65 // offset from 'A'
  return String.fromCodePoint(
    iso.toUpperCase().charCodeAt(0) + base,
    iso.toUpperCase().charCodeAt(1) + base,
  )
}

/**
 * Given a Discogs country string (e.g. "France", "UK", "US"),
 * returns a flag emoji, or an empty string if unknown.
 */
export function countryFlag(countryName) {
  if (!countryName) return ''
  const iso = COUNTRY_TO_ISO[countryName]
  return iso ? isoToFlag(iso) : ''
}
