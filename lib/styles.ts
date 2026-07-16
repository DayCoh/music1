// A deliberately broad, globally diverse catalog of musical styles.
// Goal: represent genres from every inhabited continent and many cultures, plus
// mainstream and regional (incl. US regional) styles — so anyone can find music
// that reflects them. Users can also type any style of their own in the wizard.
//
// This is plain data (no secrets) and is safe to import into client components.

export interface StyleGroup {
  region: string;
  styles: string[];
}

// A short, friendly set surfaced first as quick starting points.
export const QUICK_STYLES: string[] = [
  "Upbeat pop celebration",
  "Acoustic & heartfelt",
  "Cinematic & epic",
  "Afrobeats",
  "Reggaeton",
  "Lo-fi chill",
  "Gospel choir",
  "Bollywood",
];

export const STYLE_CATALOG: StyleGroup[] = [
  {
    region: "Popular & Global",
    styles: [
      "Pop", "Dance-Pop", "Indie Pop", "Rock", "Hip-Hop", "R&B", "Soul",
      "Afrobeats", "Amapiano", "Reggaeton", "Latin Pop", "K-Pop", "EDM",
      "House", "Country", "Folk", "Jazz",
    ],
  },
  {
    region: "Hip-Hop & R&B",
    styles: [
      "Old-School Hip-Hop", "Boom Bap", "Trap", "Drill", "UK Drill",
      "Conscious Rap", "Cloud Rap", "G-Funk", "Grime", "Afro-Rap",
      "Lo-fi Hip-Hop", "Neo-Soul", "Contemporary R&B", "New Jack Swing",
      "Funk", "Motown",
    ],
  },
  {
    region: "Electronic & Dance",
    styles: [
      "Deep House", "Tech House", "Techno", "Detroit Techno", "Trance",
      "Dubstep", "Drum & Bass", "Jungle", "UK Garage", "Future Bass",
      "Synthwave", "Retrowave", "Vaporwave", "Ambient", "IDM", "Hardstyle",
      "Eurodance", "Italo-Disco", "Disco", "Nu-Disco", "Trip-Hop",
      "Breakbeat", "Gqom", "Baile Funk",
    ],
  },
  {
    region: "Rock & Metal",
    styles: [
      "Classic Rock", "Hard Rock", "Alt Rock", "Indie Rock", "Punk Rock",
      "Pop Punk", "Post-Punk", "Grunge", "Psychedelic Rock", "Prog Rock",
      "Garage Rock", "Surf Rock", "Blues Rock", "Southern Rock", "Folk Rock",
      "Heavy Metal", "Thrash Metal", "Death Metal", "Black Metal",
      "Metalcore", "Nu Metal", "Emo", "Shoegaze", "Post-Rock",
    ],
  },
  {
    region: "Pop & Singer-Songwriter",
    styles: [
      "Synth-Pop", "Electropop", "Dream Pop", "Bedroom Pop", "Power Pop",
      "Art Pop", "Bubblegum Pop", "Teen Pop", "Chamber Pop", "City Pop",
      "Singer-Songwriter", "Acoustic", "Piano Ballad", "Folk-Pop",
    ],
  },
  {
    region: "Jazz, Blues & Soul",
    styles: [
      "Jazz", "Smooth Jazz", "Bebop", "Swing", "Big Band", "Cool Jazz",
      "Jazz Fusion", "Gypsy Jazz", "New Orleans Jazz", "Ragtime",
      "Blues", "Delta Blues", "Chicago Blues", "Soul", "Funk", "Gospel Soul",
    ],
  },
  {
    region: "Country, Folk & Americana",
    styles: [
      "Classic Country", "Country Pop", "Outlaw Country", "Bakersfield Sound",
      "Nashville", "Honky-Tonk", "Western Swing", "Bluegrass",
      "Appalachian Folk", "Old-Time", "Americana", "Alt-Country",
      "Country Rock", "Cajun", "Zydeco", "Tejano / Tex-Mex", "Sea Shanty",
    ],
  },
  {
    region: "Latin America & Caribbean",
    styles: [
      "Reggaeton", "Salsa", "Bachata", "Merengue", "Cumbia", "Bossa Nova",
      "Samba", "Tango", "Mariachi", "Ranchera", "Banda", "Norteño",
      "Corridos Tumbados", "Latin Trap", "Bolero", "Vallenato", "Forró",
      "Son Cubano", "Timba", "Dembow", "Reggae", "Dancehall", "Ska",
      "Rocksteady", "Soca", "Calypso", "Zouk", "Bomba", "Plena", "Champeta",
      "Chicha", "Axé", "MPB",
    ],
  },
  {
    region: "Africa",
    styles: [
      "Afrobeats", "Afrobeat (Fela)", "Amapiano", "Highlife", "Soukous",
      "Makossa", "Coupé-Décalé", "Ndombolo", "Mbalax", "Jùjú", "Fuji",
      "Bongo Flava", "Gengetone", "Kwaito", "Gqom", "Kwela", "Mbaqanga",
      "Chimurenga", "Benga", "Taarab", "Gnawa", "Ethio-Jazz", "Maskandi",
      "Kizomba", "Semba", "Kuduro", "Zamrock",
    ],
  },
  {
    region: "Middle East & North Africa",
    styles: [
      "Arabic Pop", "Raï", "Dabke", "Khaleeji", "Mizrahi", "Mahraganat",
      "Shaabi", "Andalusian Classical", "Turkish Pop", "Anatolian Rock",
      "Turkish Folk", "Persian Pop", "Persian Classical", "Sufi", "Malouf",
    ],
  },
  {
    region: "South Asia",
    styles: [
      "Bollywood / Filmi", "Bhangra", "Punjabi Pop", "Hindustani Classical",
      "Carnatic Classical", "Qawwali", "Ghazal", "Sufi", "Bhajan", "Kirtan",
      "Baul", "Garba / Dandiya", "Indian Folk", "Kollywood (Tamil)",
      "Tollywood (Telugu)", "Desi Hip-Hop", "Bhojpuri", "Nepali Pop", "Baila",
    ],
  },
  {
    region: "East Asia",
    styles: [
      "K-Pop", "J-Pop", "C-Pop", "Mandopop", "Cantopop", "City Pop", "Enka",
      "J-Rock", "K-R&B", "K-Hip-Hop", "Anime / OST", "Korean Trot",
      "Traditional Chinese", "Guqin", "Gagaku", "Min'yō",
      "Mongolian Throat Singing",
    ],
  },
  {
    region: "Southeast Asia & Pacific",
    styles: [
      "Dangdut", "Kroncong", "Gamelan", "Luk Thung", "Mor Lam", "Thai Pop",
      "OPM (Filipino Pop)", "Kundiman", "V-Pop", "Khmer Pop", "Malay Pop",
      "Hawaiian", "Island Reggae", "Māori Waiata", "Aboriginal / Didgeridoo",
      "Pacific Islander",
    ],
  },
  {
    region: "Europe & Mediterranean",
    styles: [
      "Flamenco", "Rumba Catalana", "Fado", "Celtic / Irish Folk",
      "Scottish Folk", "Nordic Folk", "Sámi Joik", "Polka",
      "Chanson Française", "Musette", "Balkan Brass", "Turbo-Folk", "Klezmer",
      "Rebetiko", "Greek Laïko", "Tarantella", "Neapolitan", "Schlager",
      "Yodeling", "Sevdah", "Manele", "Russian Romance", "Cossack",
    ],
  },
  {
    region: "Classical, Cinematic & Choral",
    styles: [
      "Orchestral", "Cinematic / Film Score", "Epic Trailer", "Baroque",
      "Romantic", "Opera", "Operetta", "Choral", "Gregorian Chant",
      "String Quartet", "Piano Solo", "Minimalism", "Contemporary Classical",
      "Waltz", "Marching Band", "Fanfare", "Lullaby",
    ],
  },
  {
    region: "Spiritual & Devotional",
    styles: [
      "Gospel", "Gospel Choir", "Contemporary Christian", "Worship",
      "Spirituals", "Hymns", "Qawwali", "Sufi", "Bhajan", "Kirtan",
      "Buddhist Chant", "Native American Flute", "Meditation", "Mantra",
    ],
  },
  {
    region: "Moods & Eras",
    styles: [
      "Lo-fi chill", "Ambient", "Chillout", "Downtempo", "1950s Rock & Roll",
      "1960s", "1970s Disco", "1980s Synth", "1990s", "Y2K Pop", "Anthemic",
      "Uplifting", "Romantic Ballad", "Melancholic", "Dreamy", "Epic",
      "Playful", "A Cappella", "Barbershop", "Holiday / Festive",
    ],
  },
];

// Flat, de-duplicated list for search.
export const ALL_STYLES: string[] = Array.from(
  new Set(STYLE_CATALOG.flatMap((g) => g.styles))
);
