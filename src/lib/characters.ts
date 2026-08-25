export type CharacterId = 'peter' | 'miles' | 'gwen';

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  heroName: string;
  subtitle: string;
  imageSrc: string;
  primaryColor: string;
  accentColor: string;
  webColor: string;
  glowColor: string;
  fallbackFill: string;
  description: string;
}

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  peter: {
    id: 'peter',
    name: 'Peter Parker',
    heroName: 'Spider-Man',
    subtitle: 'Classic Spidey',
    imageSrc: 'spidey.svg',
    primaryColor: '#e60000',
    accentColor: '#004dcf',
    webColor: '#ffffff',
    glowColor: 'rgba(230, 0, 0, 0.4)',
    fallbackFill: '#e60000',
    description: 'The classic friendly neighborhood hero!'
  },
  miles: {
    id: 'miles',
    name: 'Miles Morales',
    heroName: 'Spin / Spider-Man',
    subtitle: 'Bio-Electric Hero',
    imageSrc: 'miles.svg',
    primaryColor: '#1c1c24',
    accentColor: '#e60000',
    webColor: '#ffd700',
    glowColor: 'rgba(255, 215, 0, 0.4)',
    fallbackFill: '#1c1c24',
    description: 'Electrifying speed with venom-power webs!'
  },
  gwen: {
    id: 'gwen',
    name: 'Gwen Stacy',
    heroName: 'Ghost-Spider',
    subtitle: 'Web-Warrior',
    imageSrc: 'gwen.svg',
    primaryColor: '#f8fafc',
    accentColor: '#ff2a85',
    webColor: '#00e5ff',
    glowColor: 'rgba(255, 42, 133, 0.4)',
    fallbackFill: '#ffffff',
    description: 'Acrobatic style with neon glow powers!'
  }
};

export const CHARACTER_LIST: CharacterConfig[] = Object.values(CHARACTERS);
