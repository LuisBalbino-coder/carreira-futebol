// Dados estáticos do jogo: países, ligas (genéricas), clubes, posições, formações,
// seleções nacionais, confederações e marcas patrocinadoras (fictícias).

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
  NGA: {
    first: ['Chinedu', 'Emeka', 'Tunde', 'Kelechi', 'Samuel', 'Ifeanyi', 'Obi', 'Musa'],
    last: ['Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Obi', 'Nwosu', 'Okonkwo', 'Ibrahim'],
  },
  EGY: {
    first: ['Mohamed', 'Ahmed', 'Omar', 'Karim', 'Youssef', 'Hany', 'Tarek', 'Amr'],
    last: ['Hassan', 'Salah', 'Mostafa', 'Fathy', 'El-Sayed', 'Nabil', 'Gaber', 'Zaki'],
  },
  MAR: {
    first: ['Youssef', 'Achraf', 'Hamza', 'Sofiane', 'Mehdi', 'Amine', 'Oussama', 'Anas'],
    last: ['El Amrani', 'Benali', 'El Idrissi', 'Bennani', 'El Ouazzani', 'Fassi', 'Alaoui', 'Bouzid'],
  },
  SEN: {
    first: ['Sadio', 'Cheikh', 'Ibrahima', 'Moussa', 'Pape', 'Abdou', 'Lamine', 'Idrissa'],
    last: ['Diop', 'Ndiaye', 'Fall', 'Sarr', 'Gueye', 'Mbaye', 'Diallo', 'Sy'],
  },
  RSA: {
    first: ['Thabo', 'Sipho', 'Lungile', 'Mandla', 'Bongani', 'Tebogo', 'Andile', 'Kagiso'],
    last: ['Mokoena', 'Nkosi', 'Dlamini', 'Khumalo', 'Mabaso', 'Ndlovu', 'Zulu', 'Mthembu'],
  },
};

export const GENERIC_NAMES = {
  first: ['Alex', 'Adrián', 'Nikola', 'Ivan', 'Marko', 'Andrés', 'Felipe', 'Milan', 'Sebastián', 'Erik', 'Daniel', 'Leo'],
  last: ['Navarro', 'Petrov', 'Kovač', 'Jovanović', 'Silva', 'Moreno', 'Lindberg', 'Novak', 'Horvat', 'Costa', 'Vidal', 'Rossi'],
};

// Ligas e clubes são fictícios; os países e as seleções são reais.
// confed: CONMEBOL, UEFA, CONCACAF, AFC, CAF, OFC
export const COUNTRIES = [
  {
    code: 'BRA', name: 'Brasil', flag: '🇧🇷', rep: 5, confed: 'CONMEBOL', league: 'Brasileirão',
    cities: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Porto Alegre', 'Curitiba', 'Salvador', 'Recife', 'Fortaleza', 'Goiânia', 'Campinas', 'Florianópolis', 'Belém', 'Manaus', 'Vitória', 'Natal', 'Londrina'],
    suffixes: ['FC', 'EC', 'AC', 'SC', 'Atlético', 'União', 'Sporting', 'Nacional'],
  },
  {
    code: 'ARG', name: 'Argentina', flag: '🇦🇷', rep: 4, confed: 'CONMEBOL', league: 'Liga Argentina',
    cities: ['Buenos Aires', 'Córdoba', 'Rosário', 'La Plata', 'Mendoza', 'Tucumán', 'Santa Fe', 'Mar del Plata', 'Salta', 'San Juan', 'Bahía Blanca', 'Paraná', 'Resistencia', 'Neuquén', 'Santiago del Estero', 'Jujuy'],
    suffixes: ['FC', 'Atlético', 'Racing', 'Unión', 'Deportivo', 'Sportivo', 'Talleres', 'Independiente'],
  },
  {
    code: 'ENG', name: 'Inglaterra', flag: '🏴', rep: 5, confed: 'UEFA', league: 'Premier League',
    cities: ['Londres', 'Manchester', 'Liverpool', 'Birmingham', 'Leeds', 'Newcastle', 'Sheffield', 'Bristol', 'Nottingham', 'Leicester', 'Southampton', 'Brighton', 'Coventry', 'Hull', 'Stoke', 'Sunderland'],
    suffixes: ['FC', 'Athletic', 'Rovers', 'Town', 'Wanderers', 'County', 'Albion', 'Rangers'],
  },
  {
    code: 'ESP', name: 'Espanha', flag: '🇪🇸', rep: 5, confed: 'UEFA', league: 'La Liga',
    cities: ['Madri', 'Barcelona', 'Sevilha', 'Valência', 'Bilbao', 'Vigo', 'Zaragoza', 'Málaga', 'La Corunha', 'San Sebastián', 'Valladolid', 'Granada', 'Oviedo', 'Palma', 'Cádiz', 'Almería'],
    suffixes: ['CF', 'Atlético', 'Real', 'Unión', 'Deportivo', 'Racing', 'Sporting', 'Club'],
  },
  {
    code: 'ITA', name: 'Itália', flag: '🇮🇹', rep: 5, confed: 'UEFA', league: 'Serie A',
    cities: ['Milão', 'Roma', 'Turim', 'Nápoles', 'Florença', 'Gênova', 'Bolonha', 'Palermo', 'Bari', 'Verona', 'Parma', 'Cagliari', 'Udine', 'Lecce', 'Bérgamo', 'Salerno'],
    suffixes: ['FC', 'Calcio', 'AC', 'Unione', 'Sporting', 'Atletico', 'Real', 'Club'],
  },
  {
    code: 'GER', name: 'Alemanha', flag: '🇩🇪', rep: 5, confed: 'UEFA', league: 'Bundesliga',
    cities: ['Munique', 'Berlim', 'Hamburgo', 'Dortmund', 'Leipzig', 'Bremen', 'Colônia', 'Frankfurt', 'Stuttgart', 'Hannover', 'Nuremberg', 'Gelsenkirchen', 'Mainz', 'Augsburgo', 'Friburgo', 'Wolfsburg'],
    suffixes: ['FC', 'SV', 'Sporting', 'Athletik', 'Union', 'Racing', 'Club', 'Turn'],
  },
  {
    code: 'FRA', name: 'França', flag: '🇫🇷', rep: 4, confed: 'UEFA', league: 'Ligue 1',
    cities: ['Paris', 'Marselha', 'Lyon', 'Lille', 'Nice', 'Rennes', 'Nantes', 'Bordeaux', 'Estrasburgo', 'Montpellier', 'Toulouse', 'Lens', 'Saint-Étienne', 'Reims', 'Brest', 'Metz'],
    suffixes: ['FC', 'Sportif', 'Racing', 'Union', 'Olympique', 'Athlétique', 'Club', 'Étoile'],
  },
  {
    code: 'POR', name: 'Portugal', flag: '🇵🇹', rep: 4, confed: 'UEFA', league: 'Primeira Liga',
    cities: ['Lisboa', 'Porto', 'Braga', 'Guimarães', 'Coimbra', 'Aveiro', 'Faro', 'Setúbal', 'Leiria', 'Funchal', 'Évora', 'Viseu', 'Barcelos', 'Portimão', 'Chaves', 'Covilhã'],
    suffixes: ['FC', 'SC', 'CD', 'Académico', 'União', 'Sporting', 'Clube', 'Atlético'],
  },
  {
    code: 'NED', name: 'Holanda', flag: '🇳🇱', rep: 4, confed: 'UEFA', league: 'Eredivisie',
    cities: ['Amsterdã', 'Roterdã', 'Haia', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groninga', 'Arnhem', 'Breda', 'Nijmegen', 'Heerenveen', 'Alkmaar', 'Zwolle', 'Enschede', 'Leeuwarden', 'Sittard'],
    suffixes: ['FC', 'SC', 'SV', 'AFC', 'VV', 'Racing', 'Union', 'Sport'],
  },
  {
    code: 'MEX', name: 'México', flag: '🇲🇽', rep: 3, confed: 'CONCACAF', league: 'Liga MX',
    cities: ['Cidade do México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Toluca', 'León', 'Querétaro', 'Mérida', 'Veracruz', 'Pachuca', 'Torreón', 'Aguascalientes', 'San Luis Potosí', 'Oaxaca', 'Ciudad Juárez'],
    suffixes: ['FC', 'Club', 'Atlético', 'Deportivo', 'Unión', 'Real', 'Sporting', 'Racing'],
  },
  {
    code: 'USA', name: 'Estados Unidos', flag: '🇺🇸', rep: 3, confed: 'CONCACAF', league: 'Major League',
    cities: ['Nova York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle', 'Boston', 'Dallas', 'Atlanta', 'Denver', 'Filadélfia', 'Portland', 'Austin', 'Nashville', 'Kansas City', 'Minneapolis'],
    suffixes: ['FC', 'SC', 'United', 'City', 'Athletic', 'Rovers', 'Town', 'Sporting'],
  },
  {
    code: 'JPN', name: 'Japão', flag: '🇯🇵', rep: 3, confed: 'AFC', league: 'Liga Japonesa',
    cities: ['Tóquio', 'Osaka', 'Yokohama', 'Nagoya', 'Kobe', 'Sapporo', 'Fukuoka', 'Hiroshima', 'Sendai', 'Kyoto', 'Kawasaki', 'Saitama', 'Niigata', 'Shizuoka', 'Kanazawa', 'Okayama'],
    suffixes: ['FC', 'United', 'Athletic', 'Sporting', 'Club', 'Racing', 'Town', 'Rovers'],
  },
  {
    code: 'TUR', name: 'Turquia', flag: '🇹🇷', rep: 3, confed: 'UEFA', league: 'Süper Lig',
    cities: ['Istambul', 'Ancara', 'Esmirna', 'Bursa', 'Antália', 'Konya', 'Adana', 'Trabzon', 'Kayseri', 'Gaziantep', 'Samsun', 'Denizli', 'Eskişehir', 'Malatya', 'Erzurum', 'Rize'],
    suffixes: ['SK', 'FC', 'Spor', 'United', 'Athletic', 'Club', 'Racing', 'Sporting'],
  },
  {
    code: 'NGA', name: 'Nigéria', flag: '🇳🇬', rep: 3, confed: 'CAF', league: 'Liga Nigeriana',
    cities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna', 'Enugu', 'Jos', 'Aba', 'Onitsha', 'Ilorin', 'Uyo', 'Warri', 'Owerri', 'Calabar'],
    suffixes: ['FC', 'United', 'City', 'Rovers', 'Athletic', 'Stars', 'Wanderers', 'Sporting'],
  },
  {
    code: 'EGY', name: 'Egito', flag: '🇪🇬', rep: 3, confed: 'CAF', league: 'Liga Egípcia',
    cities: ['Cairo', 'Alexandria', 'Giza', 'Port Said', 'Suez', 'Ismaília', 'Mansoura', 'Tanta', 'Assuã', 'Luxor', 'Zagazig', 'Damietta', 'Sohag', 'Minya', 'Hurghada', 'Sharm el-Sheikh'],
    suffixes: ['SC', 'FC', 'Club', 'United', 'Sporting', 'Athletic', 'Union', 'Racing'],
  },
  {
    code: 'MAR', name: 'Marrocos', flag: '🇲🇦', rep: 3, confed: 'CAF', league: 'Botola',
    cities: ['Casablanca', 'Rabat', 'Marrakesh', 'Fez', 'Tânger', 'Agadir', 'Meknès', 'Oujda', 'Kenitra', 'Tetouan', 'Safi', 'El Jadida', 'Nador', 'Beni Mellal', 'Khouribga', 'Mohammedia'],
    suffixes: ['AC', 'FC', 'Club', 'Racing', 'Union', 'Sporting', 'Atlético', 'Deportivo'],
  },
  {
    code: 'SEN', name: 'Senegal', flag: '🇸🇳', rep: 3, confed: 'CAF', league: 'Liga Senegalense',
    cities: ['Dakar', 'Touba', 'Thiès', 'Saint-Louis', 'Kaolack', 'Ziguinchor', 'Diourbel', 'Louga', 'Tambacounda', 'Kolda', 'Mbour', 'Rufisque', 'Matam', 'Richard-Toll', 'Fatick', 'Kaffrine'],
    suffixes: ['FC', 'AC', 'Union', 'Sporting', 'Racing', 'Club', 'Athletic', 'Deportivo'],
  },
  {
    code: 'RSA', name: 'África do Sul', flag: '🇿🇦', rep: 2, confed: 'CAF', league: 'Liga Sul-Africana',
    cities: ['Joanesburgo', 'Cidade do Cabo', 'Durban', 'Pretória', 'Port Elizabeth', 'Bloemfontein', 'East London', 'Polokwane', 'Nelspruit', 'Kimberley', 'Pietermaritzburg', 'Rustenburg', 'Soweto', 'Stellenbosch', 'Vereeniging', 'Welkom'],
    suffixes: ['FC', 'United', 'City', 'Rovers', 'Stars', 'Athletic', 'Wanderers', 'Sporting'],
  },
];

COUNTRIES.forEach((c) => { c.names = NAME_POOLS[c.code] || GENERIC_NAMES; });

export const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export const CONFEDERATIONS = {
  CONMEBOL: { name: 'América do Sul', cup: 'Copa América', short: 'CONMEBOL' },
  UEFA: { name: 'Europa', cup: 'Eurocopa', short: 'UEFA' },
  CONCACAF: { name: 'América do Norte e Central', cup: 'Copa Ouro', short: 'CONCACAF' },
  AFC: { name: 'Ásia', cup: 'Copa Asiática', short: 'AFC' },
  CAF: { name: 'África', cup: 'Copa Africana de Nações', short: 'CAF' },
  OFC: { name: 'Oceania', cup: 'Copa da Oceania', short: 'OFC' },
};

// Seleções nacionais (as que têm liga no jogo + potências das demais confederações).
export const NATIONAL_TEAMS = [
  // UEFA
  { code: 'ESP', name: 'Espanha', flag: '🇪🇸', confed: 'UEFA', rep: 5 },
  { code: 'FRA', name: 'França', flag: '🇫🇷', confed: 'UEFA', rep: 5 },
  { code: 'ENG', name: 'Inglaterra', flag: '🏴', confed: 'UEFA', rep: 5 },
  { code: 'GER', name: 'Alemanha', flag: '🇩🇪', confed: 'UEFA', rep: 5 },
  { code: 'ITA', name: 'Itália', flag: '🇮🇹', confed: 'UEFA', rep: 5 },
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', confed: 'UEFA', rep: 4 },
  { code: 'NED', name: 'Holanda', flag: '🇳🇱', confed: 'UEFA', rep: 4 },
  { code: 'BEL', name: 'Bélgica', flag: '🇧🇪', confed: 'UEFA', rep: 4 },
  { code: 'CRO', name: 'Croácia', flag: '🇭🇷', confed: 'UEFA', rep: 4 },
  { code: 'TUR', name: 'Turquia', flag: '🇹🇷', confed: 'UEFA', rep: 3 },
  { code: 'SUI', name: 'Suíça', flag: '🇨🇭', confed: 'UEFA', rep: 3 },
  { code: 'DEN', name: 'Dinamarca', flag: '🇩🇰', confed: 'UEFA', rep: 3 },
  { code: 'SWE', name: 'Suécia', flag: '🇸🇪', confed: 'UEFA', rep: 3 },
  { code: 'SRB', name: 'Sérvia', flag: '🇷🇸', confed: 'UEFA', rep: 3 },
  { code: 'POL', name: 'Polônia', flag: '🇵🇱', confed: 'UEFA', rep: 3 },
  { code: 'UKR', name: 'Ucrânia', flag: '🇺🇦', confed: 'UEFA', rep: 3 },
  { code: 'AUT', name: 'Áustria', flag: '🇦🇹', confed: 'UEFA', rep: 3 },
  { code: 'SCO', name: 'Escócia', flag: '🏴', confed: 'UEFA', rep: 3 },
  { code: 'NOR', name: 'Noruega', flag: '🇳🇴', confed: 'UEFA', rep: 3 },
  { code: 'CZE', name: 'Tchéquia', flag: '🇨🇿', confed: 'UEFA', rep: 3 },
  { code: 'GRE', name: 'Grécia', flag: '🇬🇷', confed: 'UEFA', rep: 2 },
  { code: 'HUN', name: 'Hungria', flag: '🇭🇺', confed: 'UEFA', rep: 2 },
  // CONMEBOL
  { code: 'BRA', name: 'Brasil', flag: '🇧🇷', confed: 'CONMEBOL', rep: 5 },
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', confed: 'CONMEBOL', rep: 5 },
  { code: 'URU', name: 'Uruguai', flag: '🇺🇾', confed: 'CONMEBOL', rep: 4 },
  { code: 'COL', name: 'Colômbia', flag: '🇨🇴', confed: 'CONMEBOL', rep: 4 },
  { code: 'CHI', name: 'Chile', flag: '🇨🇱', confed: 'CONMEBOL', rep: 3 },
  { code: 'PER', name: 'Peru', flag: '🇵🇪', confed: 'CONMEBOL', rep: 3 },
  { code: 'ECU', name: 'Equador', flag: '🇪🇨', confed: 'CONMEBOL', rep: 3 },
  { code: 'PAR', name: 'Paraguai', flag: '🇵🇾', confed: 'CONMEBOL', rep: 3 },
  { code: 'VEN', name: 'Venezuela', flag: '🇻🇪', confed: 'CONMEBOL', rep: 2 },
  { code: 'BOL', name: 'Bolívia', flag: '🇧🇴', confed: 'CONMEBOL', rep: 2 },
  // CONCACAF
  { code: 'MEX', name: 'México', flag: '🇲🇽', confed: 'CONCACAF', rep: 3 },
  { code: 'USA', name: 'Estados Unidos', flag: '🇺🇸', confed: 'CONCACAF', rep: 3 },
  { code: 'CRC', name: 'Costa Rica', flag: '🇨🇷', confed: 'CONCACAF', rep: 2 },
  { code: 'CAN', name: 'Canadá', flag: '🇨🇦', confed: 'CONCACAF', rep: 2 },
  { code: 'HON', name: 'Honduras', flag: '🇭🇳', confed: 'CONCACAF', rep: 2 },
  { code: 'PAN', name: 'Panamá', flag: '🇵🇦', confed: 'CONCACAF', rep: 2 },
  { code: 'JAM', name: 'Jamaica', flag: '🇯🇲', confed: 'CONCACAF', rep: 2 },
  { code: 'SLV', name: 'El Salvador', flag: '🇸🇻', confed: 'CONCACAF', rep: 1 },
  { code: 'GUA', name: 'Guatemala', flag: '🇬🇹', confed: 'CONCACAF', rep: 1 },
  { code: 'HAI', name: 'Haiti', flag: '🇭🇹', confed: 'CONCACAF', rep: 1 },
  // AFC
  { code: 'JPN', name: 'Japão', flag: '🇯🇵', confed: 'AFC', rep: 3 },
  { code: 'KOR', name: 'Coreia do Sul', flag: '🇰🇷', confed: 'AFC', rep: 3 },
  { code: 'KSA', name: 'Arábia Saudita', flag: '🇸🇦', confed: 'AFC', rep: 3 },
  { code: 'IRN', name: 'Irã', flag: '🇮🇷', confed: 'AFC', rep: 3 },
  { code: 'AUS', name: 'Austrália', flag: '🇦🇺', confed: 'AFC', rep: 3 },
  { code: 'QAT', name: 'Catar', flag: '🇶🇦', confed: 'AFC', rep: 2 },
  { code: 'UZB', name: 'Uzbequistão', flag: '🇺🇿', confed: 'AFC', rep: 2 },
  { code: 'IRQ', name: 'Iraque', flag: '🇮🇶', confed: 'AFC', rep: 2 },
  { code: 'UAE', name: 'Emirados Árabes', flag: '🇦🇪', confed: 'AFC', rep: 2 },
  { code: 'CHN', name: 'China', flag: '🇨🇳', confed: 'AFC', rep: 2 },
  { code: 'JOR', name: 'Jordânia', flag: '🇯🇴', confed: 'AFC', rep: 1 },
  { code: 'THA', name: 'Tailândia', flag: '🇹🇭', confed: 'AFC', rep: 1 },
  // CAF
  { code: 'NGA', name: 'Nigéria', flag: '🇳🇬', confed: 'CAF', rep: 3 },
  { code: 'EGY', name: 'Egito', flag: '🇪🇬', confed: 'CAF', rep: 3 },
  { code: 'MAR', name: 'Marrocos', flag: '🇲🇦', confed: 'CAF', rep: 3 },
  { code: 'SEN', name: 'Senegal', flag: '🇸🇳', confed: 'CAF', rep: 3 },
  { code: 'ALG', name: 'Argélia', flag: '🇩🇿', confed: 'CAF', rep: 3 },
  { code: 'TUN', name: 'Tunísia', flag: '🇹🇳', confed: 'CAF', rep: 3 },
  { code: 'CMR', name: 'Camarões', flag: '🇨🇲', confed: 'CAF', rep: 3 },
  { code: 'GHA', name: 'Gana', flag: '🇬🇭', confed: 'CAF', rep: 3 },
  { code: 'CIV', name: 'Costa do Marfim', flag: '🇨🇮', confed: 'CAF', rep: 3 },
  { code: 'RSA', name: 'África do Sul', flag: '🇿🇦', confed: 'CAF', rep: 2 },
  { code: 'MLI', name: 'Mali', flag: '🇲🇱', confed: 'CAF', rep: 2 },
  { code: 'COD', name: 'RD Congo', flag: '🇨🇩', confed: 'CAF', rep: 2 },
  { code: 'BFA', name: 'Burkina Faso', flag: '🇧🇫', confed: 'CAF', rep: 2 },
  { code: 'ZAM', name: 'Zâmbia', flag: '🇿🇲', confed: 'CAF', rep: 1 },
  // OFC
  { code: 'NZL', name: 'Nova Zelândia', flag: '🇳🇿', confed: 'OFC', rep: 1 },
  { code: 'FIJ', name: 'Fiji', flag: '🇫🇯', confed: 'OFC', rep: 1 },
  { code: 'PNG', name: 'Papua-Nova Guiné', flag: '🇵🇬', confed: 'OFC', rep: 1 },
];

export const NATION_BY_CODE = Object.fromEntries(NATIONAL_TEAMS.map((n) => [n.code, n]));

// Marcas fictícias de patrocínio por porte.
export const BRANDS = {
  mundial: [
    { name: 'Colca-Cola', base: 180 },
    { name: 'Vértice Sports', base: 150 },
    { name: 'Aurora Bank', base: 135 },
    { name: 'SkyWings', base: 120 },
  ],
  nacional: [
    { name: 'Bravo Telecom', base: 42 },
    { name: 'Sabor Real', base: 34 },
    { name: 'Banco do Povo', base: 38 },
    { name: 'Energia Sul', base: 30 },
  ],
  regional: [
    { name: 'Supermercados Bom Dia', base: 9 },
    { name: 'Construtora Horizonte', base: 7 },
    { name: 'Laticínios Vale', base: 6 },
    { name: 'Auto Peças Rápido', base: 8 },
  ],
  local: [
    { name: 'Padaria do Bairro', base: 1.6 },
    { name: 'Farmácia Central', base: 1.2 },
    { name: 'Oficina Silva', base: 0.9 },
    { name: 'Mercadinho da Esquina', base: 1.4 },
  ],
};

export const SPONSOR_TIER_LABEL = {
  mundial: 'Patrocínio mundial',
  nacional: 'Patrocínio nacional',
  regional: 'Patrocínio regional',
  local: 'Patrocínio local',
  nenhum: 'Sem patrocinador',
};
