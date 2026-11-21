// Dados estáticos do jogo: países, ligas (genéricas), clubes, posições, formações.

export const ATTRS = [
  { key: 'vel', name: 'Velocidade' },
  { key: 'fin', name: 'Finalização' },
  { key: 'pas', name: 'Passe' },
  { key: 'dri', name: 'Drible' },
  { key: 'def', name: 'Defesa' },
  { key: 'fis', name: 'Físico' },
  { key: 'gol', name: 'Goleiro' },
];

export const POSITIONS = {
  GOL: { name: 'Goleiro', group: 'GK' },
  ZAG: { name: 'Zagueiro', group: 'DF' },
  LAT: { name: 'Lateral', group: 'DF' },
  VOL: { name: 'Volante', group: 'MF' },
  MEI: { name: 'Meia', group: 'MF' },
  ATA: { name: 'Atacante', group: 'FW' },
};

export const WEIGHTS = {
  GOL: { vel: 0.4, fin: 0.1, pas: 0.6, dri: 0.2, def: 1.5, fis: 1.0, gol: 6.0 },
  ZAG: { vel: 1.0, fin: 0.3, pas: 1.0, dri: 0.5, def: 3.0, fis: 2.6, gol: 0 },
  LAT: { vel: 2.4, fin: 0.4, pas: 1.6, dri: 1.1, def: 1.6, fis: 1.4, gol: 0 },
  VOL: { vel: 1.1, fin: 0.5, pas: 2.1, dri: 1.0, def: 2.4, fis: 2.0, gol: 0 },
  MEI: { vel: 1.4, fin: 1.5, pas: 3.0, dri: 2.2, def: 1.0, fis: 1.0, gol: 0 },
  ATA: { vel: 2.4, fin: 3.4, pas: 1.0, dri: 2.0, def: 0.3, fis: 1.1, gol: 0 },
};

export const BASE_ATTRS = {
  GOL: { vel: 44, fin: 28, pas: 52, dri: 40, def: 48, fis: 62, gol: 64 },
  ZAG: { vel: 55, fin: 36, pas: 52, dri: 46, def: 64, fis: 66, gol: 18 },
  LAT: { vel: 66, fin: 44, pas: 58, dri: 58, def: 56, fis: 56, gol: 15 },
  VOL: { vel: 58, fin: 50, pas: 62, dri: 56, def: 60, fis: 64, gol: 15 },
  MEI: { vel: 62, fin: 58, pas: 66, dri: 64, def: 44, fis: 52, gol: 15 },
  ATA: { vel: 68, fin: 66, pas: 56, dri: 64, def: 30, fis: 56, gol: 15 },
};

export const TRAININGS = [
  { id: 'fisico', name: 'Preparação física', desc: 'Físico e velocidade', gains: { fis: 0.55, vel: 0.22 }, fit: -6, form: 2 },
  { id: 'tecnico', name: 'Treino técnico', desc: 'Drible e passe', gains: { dri: 0.5, pas: 0.28 }, fit: -4, form: 3 },
  { id: 'finalizacao', name: 'Finalização', desc: 'Finalização e físico', gains: { fin: 0.55, fis: 0.1 }, fit: -4, form: 2 },
  { id: 'tatico', name: 'Treino tático', desc: 'Defesa, passe e entrosamento', gains: { def: 0.5, pas: 0.3 }, fit: -3, form: 5 },
  { id: 'recuperacao', name: 'Recuperação', desc: 'Recupera o físico', gains: {}, fit: 24, form: 1 },
];

export const FORMATIONS = {
  '4-3-3': { lines: [4, 3, 3] },
  '4-4-2': { lines: [4, 4, 2] },
  '4-2-3-1': { lines: [4, 5, 1] },
  '3-5-2': { lines: [3, 5, 2] },
};

export const FORMATION_KEYS = Object.keys(FORMATIONS);

const NAME_POOLS = {
  BRA: {
    first: ['Gabriel', 'Lucas', 'Rafael', 'Thiago', 'Matheus', 'Bruno', 'Diego', 'Felipe', 'Vinícius', 'Caio'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Almeida', 'Rocha', 'Nunes', 'Barbosa'],
  },
  ARG: {
    first: ['Matías', 'Nicolás', 'Facundo', 'Lautaro', 'Santiago', 'Julián', 'Emiliano', 'Gonzalo'],
    last: ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Gómez', 'Díaz'],
  },
  ENG: {
    first: ['James', 'Harry', 'Jack', 'Oliver', 'Charlie', 'George', 'Callum', 'Mason'],
    last: ['Smith', 'Taylor', 'Walker', 'Wright', 'Clarke', 'Hughes', 'Bennett', 'Foster'],
  },
  ESP: {
    first: ['Álvaro', 'Sergio', 'Pablo', 'Diego', 'Javier', 'Iker', 'Marcos', 'Rubén'],
    last: ['García', 'Martínez', 'López', 'Sánchez', 'Romero', 'Torres', 'Navarro', 'Molina'],
  },
  ITA: {
    first: ['Marco', 'Alessandro', 'Lorenzo', 'Matteo', 'Andrea', 'Francesco', 'Davide', 'Simone'],
    last: ['Rossi', 'Bianchi', 'Romano', 'Ricci', 'Marino', 'Greco', 'Conti', 'Gallo'],
  },
  GER: {
    first: ['Lukas', 'Jonas', 'Felix', 'Leon', 'Niklas', 'Tim', 'Julian', 'Moritz'],
    last: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Krüger'],
  },
  FRA: {
    first: ['Antoine', 'Hugo', 'Théo', 'Lucas', 'Mathis', 'Enzo', 'Noah', 'Rayan'],
    last: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Moreau'],
  },
  POR: {
    first: ['João', 'Rui', 'Pedro', 'Miguel', 'Diogo', 'Tiago', 'André', 'Nuno'],
    last: ['Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira', 'Pereira', 'Rodrigues', 'Martins'],
  },
  NED: {
    first: ['Daan', 'Sem', 'Luuk', 'Bram', 'Thijs', 'Sven', 'Joris', 'Rik'],
    last: ['de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder'],
  },
  MEX: {
    first: ['Luis', 'Carlos', 'Jorge', 'Alejandro', 'Óscar', 'Héctor', 'Raúl', 'Iván'],
    last: ['Hernández', 'García', 'Ramírez', 'Flores', 'Cruz', 'Reyes', 'Morales', 'Ortiz'],
  },
  USA: {
    first: ['Ethan', 'Noah', 'Liam', 'Mason', 'Logan', 'Caleb', 'Owen', 'Tyler'],
    last: ['Johnson', 'Williams', 'Brown', 'Miller', 'Davis', 'Wilson', 'Moore', 'Clark'],
  },
  JPN: {
    first: ['Haruto', 'Yuto', 'Ren', 'Sota', 'Kaito', 'Riku', 'Takumi', 'Daiki'],
    last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura'],
  },
  TUR: {
    first: ['Emre', 'Mert', 'Burak', 'Cenk', 'Kerem', 'Ozan', 'Serkan', 'Yusuf'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Arslan'],
  },
};

// Ligas e clubes são fictícios; os países são reais.
export const COUNTRIES = [
  {
    code: 'BRA', name: 'Brasil', flag: '🇧🇷', rep: 5, league: 'Brasileirão',
    cities: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Porto Alegre', 'Curitiba', 'Salvador', 'Recife', 'Fortaleza', 'Goiânia', 'Campinas', 'Florianópolis', 'Belém', 'Manaus', 'Vitória', 'Natal', 'Londrina'],
    suffixes: ['FC', 'EC', 'AC', 'SC', 'Atlético', 'União', 'Sporting', 'Nacional'],
  },
  {
    code: 'ARG', name: 'Argentina', flag: '🇦🇷', rep: 4, league: 'Liga Argentina',
    cities: ['Buenos Aires', 'Córdoba', 'Rosário', 'La Plata', 'Mendoza', 'Tucumán', 'Santa Fe', 'Mar del Plata', 'Salta', 'San Juan', 'Bahía Blanca', 'Paraná', 'Resistencia', 'Neuquén', 'Santiago del Estero', 'Jujuy'],
    suffixes: ['FC', 'Atlético', 'Racing', 'Unión', 'Deportivo', 'Sportivo', 'Talleres', 'Independiente'],
  },
  {
    code: 'ENG', name: 'Inglaterra', flag: '🏴', rep: 5, league: 'Premier League',
    cities: ['Londres', 'Manchester', 'Liverpool', 'Birmingham', 'Leeds', 'Newcastle', 'Sheffield', 'Bristol', 'Nottingham', 'Leicester', 'Southampton', 'Brighton', 'Coventry', 'Hull', 'Stoke', 'Sunderland'],
    suffixes: ['FC', 'Athletic', 'Rovers', 'Town', 'Wanderers', 'County', 'Albion', 'Rangers'],
  },
  {
    code: 'ESP', name: 'Espanha', flag: '🇪🇸', rep: 5, league: 'La Liga',
    cities: ['Madri', 'Barcelona', 'Sevilha', 'Valência', 'Bilbao', 'Vigo', 'Zaragoza', 'Málaga', 'La Corunha', 'San Sebastián', 'Valladolid', 'Granada', 'Oviedo', 'Palma', 'Cádiz', 'Almería'],
    suffixes: ['CF', 'Atlético', 'Real', 'Unión', 'Deportivo', 'Racing', 'Sporting', 'Club'],
  },
  {
    code: 'ITA', name: 'Itália', flag: '🇮🇹', rep: 5, league: 'Serie A',
    cities: ['Milão', 'Roma', 'Turim', 'Nápoles', 'Florença', 'Gênova', 'Bolonha', 'Palermo', 'Bari', 'Verona', 'Parma', 'Cagliari', 'Udine', 'Lecce', 'Bérgamo', 'Salerno'],
    suffixes: ['FC', 'Calcio', 'AC', 'Unione', 'Sporting', 'Atletico', 'Real', 'Club'],
  },
  {
    code: 'GER', name: 'Alemanha', flag: '🇩🇪', rep: 5, league: 'Bundesliga',
    cities: ['Munique', 'Berlim', 'Hamburgo', 'Dortmund', 'Leipzig', 'Bremen', 'Colônia', 'Frankfurt', 'Stuttgart', 'Hannover', 'Nuremberg', 'Gelsenkirchen', 'Mainz', 'Augsburgo', 'Friburgo', 'Wolfsburg'],
    suffixes: ['FC', 'SV', 'Sporting', 'Athletik', 'Union', 'Racing', 'Club', 'Turn'],
  },
  {
    code: 'FRA', name: 'França', flag: '🇫🇷', rep: 4, league: 'Ligue 1',
    cities: ['Paris', 'Marselha', 'Lyon', 'Lille', 'Nice', 'Rennes', 'Nantes', 'Bordeaux', 'Estrasburgo', 'Montpellier', 'Toulouse', 'Lens', 'Saint-Étienne', 'Reims', 'Brest', 'Metz'],
    suffixes: ['FC', 'Sportif', 'Racing', 'Union', 'Olympique', 'Athlétique', 'Club', 'Étoile'],
  },
  {
    code: 'POR', name: 'Portugal', flag: '🇵🇹', rep: 4, league: 'Primeira Liga',
    cities: ['Lisboa', 'Porto', 'Braga', 'Guimarães', 'Coimbra', 'Aveiro', 'Faro', 'Setúbal', 'Leiria', 'Funchal', 'Évora', 'Viseu', 'Barcelos', 'Portimão', 'Chaves', 'Covilhã'],
    suffixes: ['FC', 'SC', 'CD', 'Académico', 'União', 'Sporting', 'Clube', 'Atlético'],
  },
  {
    code: 'NED', name: 'Holanda', flag: '🇳🇱', rep: 4, league: 'Eredivisie',
    cities: ['Amsterdã', 'Roterdã', 'Haia', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groninga', 'Arnhem', 'Breda', 'Nijmegen', 'Heerenveen', 'Alkmaar', 'Zwolle', 'Enschede', 'Leeuwarden', 'Sittard'],
    suffixes: ['FC', 'SC', 'SV', 'AFC', 'VV', 'Racing', 'Union', 'Sport'],
  },
  {
    code: 'MEX', name: 'México', flag: '🇲🇽', rep: 3, league: 'Liga MX',
    cities: ['Cidade do México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Toluca', 'León', 'Querétaro', 'Mérida', 'Veracruz', 'Pachuca', 'Torreón', 'Aguascalientes', 'San Luis Potosí', 'Oaxaca', 'Ciudad Juárez'],
    suffixes: ['FC', 'Club', 'Atlético', 'Deportivo', 'Unión', 'Real', 'Sporting', 'Racing'],
  },
  {
    code: 'USA', name: 'Estados Unidos', flag: '🇺🇸', rep: 3, league: 'Major League',
    cities: ['Nova York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle', 'Boston', 'Dallas', 'Atlanta', 'Denver', 'Filadélfia', 'Portland', 'Austin', 'Nashville', 'Kansas City', 'Minneapolis'],
    suffixes: ['FC', 'SC', 'United', 'City', 'Athletic', 'Rovers', 'Town', 'Sporting'],
  },
  {
    code: 'JPN', name: 'Japão', flag: '🇯🇵', rep: 3, league: 'Liga Japonesa',
    cities: ['Tóquio', 'Osaka', 'Yokohama', 'Nagoya', 'Kobe', 'Sapporo', 'Fukuoka', 'Hiroshima', 'Sendai', 'Kyoto', 'Kawasaki', 'Saitama', 'Niigata', 'Shizuoka', 'Kanazawa', 'Okayama'],
    suffixes: ['FC', 'United', 'Athletic', 'Sporting', 'Club', 'Racing', 'Town', 'Rovers'],
  },
  {
    code: 'TUR', name: 'Turquia', flag: '🇹🇷', rep: 3, league: 'Süper Lig',
    cities: ['Istambul', 'Ancara', 'Esmirna', 'Bursa', 'Antália', 'Konya', 'Adana', 'Trabzon', 'Kayseri', 'Gaziantep', 'Samsun', 'Denizli', 'Eskişehir', 'Malatya', 'Erzurum', 'Rize'],
    suffixes: ['SK', 'FC', 'Spor', 'United', 'Athletic', 'Club', 'Racing', 'Sporting'],
  },
];

COUNTRIES.forEach((c) => { c.names = NAME_POOLS[c.code]; });

export const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
