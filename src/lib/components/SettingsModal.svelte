<script lang="ts">
  import { base } from '$app/paths';
  import { CHARACTER_LIST, type CharacterId } from '$lib/characters';

  interface Props {
    selectedCharacter: CharacterId;
    difficulty: number;
    soundEnabled: boolean;
    onSelectCharacter: (id: CharacterId) => void;
    onChangeDifficulty: (lvl: number) => void;
    onToggleSound: () => void;
    onClose: () => void;
  }

  let {
    selectedCharacter,
    difficulty,
    soundEnabled,
    onSelectCharacter,
    onChangeDifficulty,
    onToggleSound,
    onClose
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Game Settings">
  <div class="settings-card">
    <div class="header">
      <h2>Hero Settings</h2>
      <button class="close-icon" onclick={onClose} aria-label="Close settings">✖</button>
    </div>

    <!-- Character Selection Section -->
    <div class="section">
      <div class="section-title">Choose Your Hero</div>
      <div class="character-grid">
        {#each CHARACTER_LIST as char}
          <button
            type="button"
            class="character-card"
            class:active={selectedCharacter === char.id}
            style="--char-accent: {char.accentColor}; --char-glow: {char.glowColor};"
            onclick={() => onSelectCharacter(char.id)}
          >
            <div class="avatar-box">
              <img src="{base}/{char.imageSrc}" alt={char.heroName} class="avatar-img" />
              {#if selectedCharacter === char.id}
                <div class="selected-badge">✓</div>
              {/if}
            </div>
            <div class="char-info">
              <div class="hero-name">{char.heroName}</div>
              <div class="real-name">{char.name}</div>
              <div class="char-desc">{char.subtitle}</div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Difficulty & Sound Section -->
    <div class="options-row">
      <div class="option-group">
        <div class="option-label">Difficulty</div>
        <div class="difficulty-buttons">
          <button
            class="diff-btn"
            class:active={difficulty === 1}
            onclick={() => onChangeDifficulty(1)}
          >
            ⭐ Easy
          </button>
          <button
            class="diff-btn"
            class:active={difficulty === 2}
            onclick={() => onChangeDifficulty(2)}
          >
            ⚡ Medium
          </button>
          <button
            class="diff-btn"
            class:active={difficulty === 3}
            onclick={() => onChangeDifficulty(3)}
          >
            🔥 Hard
          </button>
        </div>
      </div>

      <div class="option-group">
        <div class="option-label">Audio</div>
        <button
          class="sound-toggle-btn"
          class:active={soundEnabled}
          onclick={onToggleSound}
        >
          {soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: MUTED'}
        </button>
      </div>
    </div>

    <button class="done-btn" onclick={onClose}>
      Done & Play!
    </button>
  </div>
</div>

<style>
  .modal-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: rgba(10, 10, 16, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 50;
    padding: 16px;
    box-sizing: border-box;
  }

  .settings-card {
    background: #181824;
    border: 3px solid var(--spidey-blue);
    box-shadow: 0 0 30px rgba(0, 77, 207, 0.6);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    max-height: 92%;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: white;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 10px;
  }

  h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 900;
    color: var(--electro-yellow);
    text-shadow: 2px 2px 0 var(--venom-black), 0 0 10px rgba(255, 215, 0, 0.4);
    letter-spacing: 0.5px;
  }

  .close-icon {
    background: transparent;
    border: none;
    color: #aaa;
    font-size: 22px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: color 0.15s, transform 0.1s;
  }

  .close-icon:hover {
    color: white;
    transform: scale(1.1);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #8bb5ff;
  }

  .character-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .character-card {
    background: #222233;
    border: 3px solid #3d3d5c;
    border-radius: 12px;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
  }

  .character-card:hover {
    transform: translateY(-3px);
    border-color: #7070a0;
    background: #2b2b40;
  }

  .character-card.active {
    background: #26263d;
    border-color: var(--char-accent);
    box-shadow: 0 0 20px var(--char-glow), inset 0 0 12px var(--char-glow);
    transform: scale(1.03);
  }

  .avatar-box {
    position: relative;
    width: 60px;
    height: 60px;
    margin-bottom: 8px;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));
  }

  .selected-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: var(--char-accent);
    color: white;
    font-size: 13px;
    font-weight: bold;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
  }

  .char-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hero-name {
    font-size: 15px;
    font-weight: 800;
    color: white;
  }

  .character-card.active .hero-name {
    color: var(--char-accent);
    text-shadow: 0 0 8px var(--char-glow);
  }

  .real-name {
    font-size: 12px;
    color: #bbb;
  }

  .char-desc {
    font-size: 10px;
    color: #888;
    margin-top: 2px;
    line-height: 1.2;
  }

  .options-row {
    display: flex;
    gap: 16px;
    justify-content: space-between;
    flex-wrap: wrap;
    background: #1f1f2e;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid #33334d;
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 180px;
  }

  .option-label {
    font-size: 13px;
    font-weight: bold;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .difficulty-buttons {
    display: flex;
    gap: 6px;
  }

  .diff-btn {
    flex: 1;
    padding: 8px 10px;
    font-size: 14px;
    font-weight: bold;
    color: #ccc;
    background: #2b2b3d;
    border: 2px solid #444460;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .diff-btn:hover {
    border-color: #7777aa;
    color: white;
  }

  .diff-btn.active {
    background: var(--spidey-blue);
    border-color: white;
    color: white;
    box-shadow: 0 0 10px rgba(0, 77, 207, 0.6);
  }

  .sound-toggle-btn {
    padding: 8px 14px;
    font-size: 14px;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    background: #2b2b3d;
    border: 2px solid #444460;
    color: #aaa;
    transition: all 0.15s ease;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sound-toggle-btn.active {
    background: #1b4d2e;
    border-color: #33cc66;
    color: #aaffcc;
    box-shadow: 0 0 10px rgba(51, 204, 102, 0.3);
  }

  .done-btn {
    padding: 12px 28px;
    font-size: 20px;
    font-weight: 900;
    color: white;
    background: var(--spidey-red);
    border: 3px solid white;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 4px 0 var(--spidey-blue);
    transition: transform 0.1s, box-shadow 0.1s;
    text-transform: uppercase;
    letter-spacing: 1px;
    align-self: center;
    margin-top: 4px;
  }

  .done-btn:hover {
    filter: brightness(1.1);
  }

  .done-btn:active {
    transform: translateY(4px);
    box-shadow: 0 0 0 var(--spidey-blue);
  }

  @media (max-width: 600px) {
    .character-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .character-card {
      flex-direction: row;
      text-align: left;
      gap: 12px;
    }
    .options-row {
      flex-direction: column;
    }
  }
</style>
