# Spider-Man Kids Web Game - Agent Guidelines

This document defines the architecture, rules, and guidelines for developing the Spider-Man kids web game in this workspace. All agents working in this codebase must adhere to these standards.

---

## 🚀 Technology Stack

1. **Runtime & Package Manager**: [Bun](https://bun.sh/)
   - Fast package manager, bundler, and runner.
   - Run dev server: `bun run dev`
   - Build production: `bun run build`
2. **Framework**: [Svelte 5](https://svelte.dev/)
   - Standardize on Svelte 5 Runes for reactivity:
     - Use `$state` for reactive state.
     - Use `$derived` for computed values.
     - Use `$effect` for side-effects (DOM interaction, canvas loops).
3. **Language**: [TypeScript](https://www.typescriptlang.org/)
   - Static typing for robust game state, entity models, and physics configurations.
   - Strict mode enabled for prevention of null/undefined bugs.
4. **Styling**: Vanilla CSS
   - Maximize flexibility, fast rendering, and clean responsive CSS.
   - Use custom CSS variables for design tokens (colors, animations, fonts).
   - Prioritize premium aesthetic: dark theme base, vibrant neon accents (Spider-man red/blue, Venom black/purple, Electro yellow), smooth animations, glassmorphism UI.

---

## 📱 Platform & Performance Guidelines

To ensure the game runs smoothly on both low-end mobile devices and high-resolution desktops:

- **Performance First**:
  - Keep the game loop separate from Svelte's reactive rendering where possible (e.g., inside an HTML5 `<canvas>` managed via `requestAnimationFrame`).
  - Avoid rendering too many active DOM elements during gameplay.
  - Optimize asset loading (compress PNG/WebP, preload critical audio/images).
- **Responsive Layout**:
  - Main container: Lock aspect ratio (e.g., 16:9 or 4:3) and scale it using CSS transform or responsive width/height to fit any screen.
  - Center the container horizontally and vertically.
- **Controls**:
  - **Desktop**: Keyboard input (Arrow keys, WASD, Space).
  - **Mobile**: Touch zones, virtual joystick, or swipe/tap actions. Make tap zones large enough for small hands (minimum 48px x 48px).

---

## 🎨 Kids Game Design Rules

- **Mechanics**: Keep controls and objectives simple (e.g., tap to web-swing, collect spiders, dodge obstacles).
- **Visuals**: Large buttons, clear iconography, bright playful colors, friendly UI text, and animated rewards/popups.
- **Feedback**: Immediate visual feedback for actions (sparkles, sound effect triggers, screen shake).
- **Safety**: No real violence, friendly/cartoonish enemies, and intuitive pause/play controls.

---

## 📁 Suggested Directory Structure

```
spidey-game/
├── .agents/
│   └── AGENTS.md         # This rule file
├── src/
│   ├── assets/           # Images, audio, fonts
│   ├── components/       # Game UI components (HUD, Menus, Modals)
│   ├── game/             # Game engine, loop, entities, physics
│   ├── routes/           # Pages (if using SvelteKit) or routing layout
│   ├── App.svelte        # Main Entrypoint
│   └── main.ts           # Svelte initialization
├── index.html
├── package.json
├── tsconfig.json
└── bun.lockb
```

---

## 🛠️ Code Conventions

### Svelte 5 Runes with TypeScript Example

Use modern Svelte 5 runes with `<script lang="ts">`:
```svelte
<script lang="ts">
  // Types definition
  interface GameStats {
    score: number;
    lives: number;
  }

  // Reactive state using generic parameters
  let stats = $state<GameStats>({
    score: 0,
    lives: 3
  });
  
  let isGameOver = $state<boolean>(false);

  // Derived state
  let scoreMessage = $derived(`Score: ${stats.score}`);

  // Game Loop instantiation & lifecycle
  $effect(() => {
    // Run loop setup here (attaches event listeners, canvas context)
    return () => {
      // Clean up event listeners here
    };
  });
</script>
```

### CSS Guidelines
Define central theme colors in a global css file:
```css
:root {
  --spidey-red: #e60000;
  --spidey-blue: #004dcf;
  --venom-black: #111116;
  --electro-yellow: #ffd700;
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
}
```

