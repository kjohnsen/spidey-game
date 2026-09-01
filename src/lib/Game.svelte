<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import { CHARACTERS, type CharacterId } from '$lib/characters';

  // UI state
  let canvas = $state<HTMLCanvasElement | null>(null);
  let score = $state(0);
  let isPlaying = $state(false);
  let isPaused = $state(false);
  let isGameOver = $state(false);
  let showSettings = $state(false);

  // Settings & Customization
  let selectedCharacter = $state<CharacterId>('peter');
  let difficulty = $state(2);
  let soundEnabled = $state(true);

  let activeCharacterConfig = $derived(CHARACTERS[selectedCharacter] || CHARACTERS.peter);
  let scoreMessage = $derived(`Score: ${Math.floor(score)}`);
  
  let playerHealth = $state(3);
  let invincibilityTimer = 0;

  onMount(() => {
    try {
      const savedChar = localStorage.getItem('spidey_character') as CharacterId;
      if (savedChar && CHARACTERS[savedChar]) {
        selectedCharacter = savedChar;
      }
      const savedDiff = localStorage.getItem('spidey_difficulty');
      if (savedDiff) {
        difficulty = parseInt(savedDiff, 10) || 2;
      }
      const savedSound = localStorage.getItem('spidey_sound');
      if (savedSound !== null) {
        soundEnabled = savedSound === 'true';
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  });

  function setCharacter(id: CharacterId) {
    selectedCharacter = id;
    try {
      localStorage.setItem('spidey_character', id);
    } catch (e) {}
  }

  function setDifficulty(lvl: number) {
    difficulty = lvl;
    try {
      localStorage.setItem('spidey_difficulty', String(lvl));
    } catch (e) {}
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem('spidey_sound', String(soundEnabled));
    } catch (e) {}
  }

  // Game constants
  const GRAVITY = 1800;
  const JUMP_FORCE = -700;
  let GAME_SPEED = 400;
  const GROUND_Y = 350;

  // Physics state
  let playerWorldX = 100;
  let playerWorldY = GROUND_Y;
  let playerVx = GAME_SPEED;
  let playerVy = 0;
  let cameraX = 0;
  
  let isSwinging = false;
  let isZiplining = false;
  let ziplineAnchorWorldX = 0;
  let ziplineAnchorWorldY = 0;
  let anchorWorldX = 0;
  let anchorWorldY = 0;
  let webLength = 0;
  let isActionPressed = false;
  
  let touchStartX = 0;
  let touchStartY = 0;

  interface Obstacle { worldX: number; width: number; height: number; type: 'hydrant' | 'trash' | 'tentacle'; }
  let obstacles: Obstacle[] = [];
  let nextObstacleWorldX = 800;

  interface Collectible { worldX: number; worldY: number; collected: boolean; }
  let collectibles: Collectible[] = [];
  let nextCollectibleWorldX = 600;

  // Boss state
  let villainQueue: string[] = [];
  let activeVillain = $state<string | null>(null);
  let activeVillainHealth = 0;
  let bossPhase = 0;
  let nextVillainScoreThreshold = 1000;
  
  interface Projectile { worldX: number; worldY: number; vx: number; vy?: number; isBomb: boolean; isAcid?: boolean; isSymbiote?: boolean; }
  let projectiles: Projectile[] = [];
  let attackProjectiles: Projectile[] = [];

  // Audio System
  let audioCtx: AudioContext | null = null;
  function initAudio() {
    if (typeof window !== 'undefined' && !audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type: 'jump' | 'shoot' | 'hit' | 'collect' | 'bomb') {
    if (!soundEnabled) return;
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'jump') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'shoot') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'collect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.05);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'bomb') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
  }

  const hash = (n: number) => { let s = Math.sin(n) * 43758.5453123; return s - Math.floor(s); };
  const getBuildingHeight = (index: number) => 280 + hash(index) * 140;
  const getMidBuildingHeight = (index: number) => 300 + hash(index + 100) * 120;

  function triggerAction() {
    initAudio();
    if (isGameOver || !isPlaying) { startGame(); return; }
    if (isPaused) return;

    if (playerWorldY >= GROUND_Y - 5) {
      playerVy = JUMP_FORCE;
      isSwinging = false;
      playSound('jump');
    } else if (!isSwinging) {
      const fgWidth = 200;
      const startIdx = Math.floor(cameraX / fgWidth);
      let bestAnchor = null;
      for (let i = 0; i < 6; i++) {
        const idx = startIdx + i;
        const roofEdgeWorldX = idx * fgWidth + fgWidth - 15;
        if (roofEdgeWorldX > playerWorldX + 50 && roofEdgeWorldX < cameraX + 800) {
          const h = getBuildingHeight(idx);
          bestAnchor = { worldX: roofEdgeWorldX, worldY: GROUND_Y + 50 - h };
          break;
        }
      }
      if (bestAnchor) {
        isSwinging = true;
        playSound('shoot');
        anchorWorldX = bestAnchor.worldX;
        anchorWorldY = bestAnchor.worldY;
        const dx = anchorWorldX - playerWorldX;
        const dy = anchorWorldY - playerWorldY;
        webLength = Math.sqrt(dx * dx + dy * dy) * 0.85;
      }
    }
  }

  function releaseAction() {
    isSwinging = false;
    if (playerVy < -100 && playerWorldY < GROUND_Y - 5) {
      playerVy *= 0.4;
    }
  }

  function shootWeb() {
    initAudio();
    if (isPlaying && !isGameOver && !isPaused) {
      playSound('shoot');
      attackProjectiles.push({ 
        worldX: playerWorldX + 20, 
        worldY: playerWorldY + 10, 
        vx: 1200, 
        isBomb: false 
      });
    }
  }

  function triggerZipline() {
    initAudio();
    if (isGameOver || !isPlaying || isPaused) return;
    if (!isZiplining) {
       const localX = playerWorldX % 200;
       if (localX > 185) return; // Not under a roof

       playerVy = -1100;
       isZiplining = true;
       isSwinging = false;
       playSound('jump');
       ziplineAnchorWorldX = playerWorldX;
       const roofIdx = Math.floor(ziplineAnchorWorldX / 200);
       ziplineAnchorWorldY = GROUND_Y + 50 - getBuildingHeight(roofIdx);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (showSettings) {
      if (e.code === 'Escape') {
        e.preventDefault();
        showSettings = false;
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!isActionPressed) { isActionPressed = true; triggerAction(); }
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      shootWeb();
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      triggerZipline();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      if (isPlaying && !isGameOver) isPaused = !isPaused;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (showSettings) return;
    if (e.code === 'Space') { isActionPressed = false; releaseAction(); }
  }

  function handlePointerDown(e: PointerEvent) {
    if (showSettings) return;
    e.preventDefault();
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    if (!isActionPressed) { isActionPressed = true; triggerAction(); }
  }

  function handlePointerUp(e: PointerEvent) {
    if (showSettings) return;
    e.preventDefault();
    const dx = e.clientX - touchStartX;
    const dy = e.clientY - touchStartY;
    
    if (dy < -50 && Math.abs(dx) < 50) {
      triggerZipline();
    } else if (dx > 40) {
      shootWeb();
    }
    
    isActionPressed = false;
    releaseAction();
  }

  function startGame() {
    initAudio();
    isPlaying = true;
    isPaused = false;
    isGameOver = false;
    score = 0;
    
    GAME_SPEED = 300 + difficulty * 100;
    playerHealth = 4 - difficulty; // Easy: 3, Med: 2, Hard: 1
    invincibilityTimer = 0;
    
    playerWorldX = 100;
    playerWorldY = GROUND_Y;
    playerVx = GAME_SPEED;
    playerVy = 0;
    cameraX = 0;
    isSwinging = false;
    isZiplining = false;
    obstacles = [];
    nextObstacleWorldX = 800;
    collectibles = [];
    nextCollectibleWorldX = 600;
    
    villainQueue = ['goblin', 'hobgoblin', 'docock', 'scorpion', 'carnage'].sort(() => Math.random() - 0.5);
    activeVillain = null;
    activeVillainHealth = 0;
    nextVillainScoreThreshold = 1000;
    
    projectiles = [];
    attackProjectiles = [];
  }

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const heroImages: Record<CharacterId, { img: HTMLImageElement; loaded: boolean }> = {
      peter: { img: new Image(), loaded: false },
      miles: { img: new Image(), loaded: false },
      gwen: { img: new Image(), loaded: false }
    };

    heroImages.peter.img.src = `${base}/spidey.svg`;
    heroImages.peter.img.onload = () => heroImages.peter.loaded = true;

    heroImages.miles.img.src = `${base}/miles.svg`;
    heroImages.miles.img.onload = () => heroImages.miles.loaded = true;

    heroImages.gwen.img.src = `${base}/gwen.svg`;
    heroImages.gwen.img.onload = () => heroImages.gwen.loaded = true;

    const goblinImg = new Image();
    goblinImg.src = `${base}/goblin.svg`;
    let goblinLoaded = false;
    goblinImg.onload = () => goblinLoaded = true;
    
    const docOckImg = new Image();
    docOckImg.src = `${base}/docock.svg`;
    let docOckLoaded = false;
    docOckImg.onload = () => docOckLoaded = true;
    
    const scorpionImg = new Image();
    scorpionImg.src = `${base}/scorpion.svg`;
    let scorpionLoaded = false;
    scorpionImg.onload = () => scorpionLoaded = true;

    const carnageImg = new Image();
    carnageImg.src = `${base}/carnage.svg`;
    let carnageLoaded = false;
    carnageImg.onload = () => carnageLoaded = true;

    const hobgoblinImg = new Image();
    hobgoblinImg.src = `${base}/hobgoblin.svg`;
    let hobgoblinLoaded = false;
    hobgoblinImg.onload = () => hobgoblinLoaded = true;
    
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animationFrameId = requestAnimationFrame(loop);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (isPaused || !isPlaying || isGameOver) return;
      
      if (invincibilityTimer > 0) invincibilityTimer -= dt;

      // Physics
      playerVy += GRAVITY * dt;
      if (!isSwinging) playerVx += (GAME_SPEED - playerVx) * 3 * dt;

      playerWorldX += playerVx * dt;
      playerWorldY += playerVy * dt;

      if (isSwinging) {
        if (playerWorldY <= anchorWorldY) {
          isSwinging = false;
        } else {
          const dx = playerWorldX - anchorWorldX;
          const dy = playerWorldY - anchorWorldY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > webLength) {
            const diff = dist - webLength;
            playerWorldX -= (dx/dist) * diff;
            playerWorldY -= (dy/dist) * diff;
            const dot = playerVx * (dx/dist) + playerVy * (dy/dist);
            if (dot > 0) {
              playerVx -= dot * (dx/dist);
              playerVy -= dot * (dy/dist);
            }
          }
        }
      }

      if (playerWorldY > GROUND_Y) {
        playerWorldY = GROUND_Y;
        playerVy = 0;
        playerVx = GAME_SPEED;
        isSwinging = false;
      }
      
      if (isZiplining) {
        if (playerVy >= 0) isZiplining = false;
        ziplineAnchorWorldX = playerWorldX; // Anchor stays directly above
        const roofIdx = Math.floor(ziplineAnchorWorldX / 200);
        ziplineAnchorWorldY = GROUND_Y + 50 - getBuildingHeight(roofIdx);
        
        // Cap jump height to the roof
        if (playerWorldY < ziplineAnchorWorldY) {
          playerWorldY = ziplineAnchorWorldY;
          playerVy = 0;
          isZiplining = false;
        }
      }
      
      const targetCameraX = playerWorldX - 150;
      cameraX += GAME_SPEED * dt;
      if (targetCameraX > cameraX) cameraX += (targetCameraX - cameraX) * 5 * dt;
      score += (cameraX * dt) / 10;
      
      const takeDamage = () => {
        if (invincibilityTimer > 0) return;
        playerHealth -= 1;
        if (playerHealth <= 0) {
          isPlaying = false;
          isGameOver = true;
          playSound('bomb');
          ctx.fillStyle = 'rgba(230, 0, 0, 0.5)';
          ctx.fillRect(0, 0, 800, 450);
        } else {
          playSound('hit');
          invincibilityTimer = 1.0;
        }
      };
      
      if (playerWorldX < cameraX - 40) {
        playerHealth = 0;
        isPlaying = false;
        isGameOver = true;
        playSound('bomb');
      }

      // Boss Logic
      if (!activeVillain && villainQueue.length > 0 && score >= nextVillainScoreThreshold) {
        activeVillain = villainQueue.shift()!;
        bossPhase = 0;
        if (activeVillain === 'goblin') activeVillainHealth = 3;
        else if (activeVillain === 'hobgoblin') activeVillainHealth = 4;
        else if (activeVillain === 'docock') activeVillainHealth = 5;
        else if (activeVillain === 'scorpion') activeVillainHealth = 4;
        else if (activeVillain === 'carnage') activeVillainHealth = 6;
      }

      let bossScreenX = 650;
      let bossScreenY = 0;

      if (activeVillain === 'goblin') {
        bossPhase += dt * 3;
        bossScreenY = 150 + Math.sin(bossPhase) * 100;
        if (Math.random() < 0.015) {
           projectiles.push({
             worldX: cameraX + bossScreenX,
             worldY: bossScreenY + 20,
             vx: Math.random() * -100 - 100,
             vy: -200 + Math.random() * -200,
             isBomb: true
           });
        }
      } else if (activeVillain === 'hobgoblin') {
        bossPhase += dt * 4;
        bossScreenY = 120 + Math.sin(bossPhase) * 120;
        if (Math.random() < 0.02) {
           projectiles.push({
             worldX: cameraX + bossScreenX,
             worldY: bossScreenY + 20,
             vx: Math.random() * -150 - 150,
             vy: -150 + Math.random() * -150,
             isBomb: true
           });
        }
      } else if (activeVillain === 'docock') {
        bossPhase += dt * 2;
        bossScreenY = 100 + Math.sin(bossPhase) * 60;
      } else if (activeVillain === 'scorpion') {
        bossPhase += dt * 4;
        bossScreenX = 400 + Math.sin(bossPhase) * 200; // Dash back and forth
        bossScreenY = GROUND_Y - 30; // Level with Spidey (bottom aligns with ground)
        
        // Melee collision check
        const playerScreenX = playerWorldX - cameraX;
        if (
          playerScreenX < bossScreenX + 50 && playerScreenX + 40 > bossScreenX + 20 &&
          playerWorldY < bossScreenY + 60 && playerWorldY + 40 > bossScreenY + 10
        ) {
          takeDamage();
        }
      } else if (activeVillain === 'carnage') {
        bossPhase += dt * 5;
        bossScreenX = 600 + Math.cos(bossPhase * 0.5) * 50;
        bossScreenY = (GROUND_Y - 50) - Math.abs(Math.sin(bossPhase)) * 180; // Bouncing wildly
        if (Math.random() < 0.02) {
           projectiles.push({
             worldX: cameraX + bossScreenX,
             worldY: bossScreenY + 20,
             vx: Math.random() * -300 - 100,
             vy: -100 + Math.random() * -150,
             isBomb: true,
             isAcid: false,
             isSymbiote: true
           });
        }
      }


      // Attack projectiles (webs)
      for (let i = attackProjectiles.length - 1; i >= 0; i--) {
        const p = attackProjectiles[i];
        p.worldX += p.vx * dt;
        if (p.worldX > cameraX + 800) {
          attackProjectiles.splice(i, 1);
        } else if (
          activeVillain && 
          p.worldX > cameraX + bossScreenX - 20 && p.worldX < cameraX + bossScreenX + 60 &&
          p.worldY > bossScreenY - 20 && p.worldY < bossScreenY + 60
        ) {
           playSound('hit');
           attackProjectiles.splice(i, 1);
           
           activeVillainHealth -= 1;
           if (activeVillainHealth <= 0) {
              const defeatScore = activeVillain === 'goblin' ? 1000 : (activeVillain === 'docock' ? 2000 : (activeVillain === 'carnage' ? 2500 : (activeVillain === 'hobgoblin' ? 1200 : 1500)));
              score += defeatScore;
              activeVillain = null;
              nextVillainScoreThreshold = score + 1000;
           }
        }
      }

      // Enemy projectiles (bombs/acid)
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.worldX += p.vx * dt;
        if (!p.isAcid) {
          p.vy = (p.vy || 0) + GRAVITY * 0.4 * dt;
          p.worldY += p.vy * dt;
        }
        
        if (p.worldX < cameraX - 50 || p.worldY > GROUND_Y + 50) {
          projectiles.splice(i, 1);
          continue;
        }
        
        if (
          p.worldX < playerWorldX + 35 && p.worldX + 15 > playerWorldX &&
          p.worldY < playerWorldY + 35 && p.worldY + 15 > playerWorldY
        ) {
          projectiles.splice(i, 1);
          takeDamage();
        }
      }

      // Spawning obstacles
      if (activeVillain !== 'goblin' && activeVillain !== 'hobgoblin' && activeVillain !== 'scorpion' && activeVillain !== 'carnage' && cameraX > nextObstacleWorldX - 800) {
        let obsType = Math.random() > 0.5 ? 'hydrant' : 'trash';
        let obsWidth = Math.random() > 0.5 ? 25 : 35;
        let obsHeight = Math.random() > 0.5 ? 40 : 50;
        
        if (activeVillain === 'docock') {
          obsType = 'tentacle';
          obsWidth = 30;
          obsHeight = 90 + Math.random() * 40;
        }

        obstacles.push({
          worldX: nextObstacleWorldX, 
          width: obsWidth,
          height: obsHeight, 
          type: obsType as any
        });
        nextObstacleWorldX += (activeVillain === 'docock' ? 250 : 400) + Math.random() * 400;
      }

      if (cameraX > nextCollectibleWorldX - 800) {
        const spiderY = 50 + Math.random() * 200;
        collectibles.push({ worldX: nextCollectibleWorldX, worldY: spiderY, collected: false });
        nextCollectibleWorldX += 300 + Math.random() * 400;
      }

      // RENDER
      ctx.clearRect(0, 0, 800, 450);
      
      ctx.fillStyle = '#111116';
      ctx.fillRect(0, 0, 800, 450);

      const midScroll = cameraX * 0.5;
      const startMidIdx = Math.floor(midScroll / 120);
      for (let i = 0; i < 9; i++) {
        const idx = startMidIdx + i;
        const h = getMidBuildingHeight(idx);
        const midScreenX = (idx * 120) - (midScroll % 120);
        const midY = GROUND_Y + 50 - h;
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(midScreenX, midY, 110, h);
        
        // Midground windows
        const mCols = 3;
        const mRows = Math.floor(h / 40);
        for (let r = 0; r < mRows; r++) {
          for (let c = 0; c < mCols; c++) {
            const isLit = hash(idx * 100 + r * 10 + c) > 0.4;
            ctx.fillStyle = isLit ? '#232338' : '#141424';
            ctx.fillRect(midScreenX + 15 + c * 30, midY + 20 + r * 40, 15, 25);
          }
        }
      }

      const startFgIdx = Math.floor(cameraX / 200);
      for (let i = 0; i < 6; i++) {
        const idx = startFgIdx + i;
        const h = getBuildingHeight(idx);
        const screenX = idx * 200 - cameraX;
        const y = GROUND_Y + 50 - h;
        
        ctx.fillStyle = '#2d2d44';
        ctx.fillRect(screenX, y, 185, h);
        
        // Foreground windows
        const cols = 4;
        const rows = Math.floor(h / 50);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const isLit = hash(idx * 100 + r * 10 + c) > 0.5;
            ctx.fillStyle = isLit ? '#3b3b5c' : '#222233';
            ctx.fillRect(screenX + 22 + c * 38, y + 25 + r * 50, 20, 30);
          }
        }

        ctx.fillStyle = '#004dcf';
        ctx.fillRect(screenX, y, 185, 6);
      }

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, GROUND_Y + 40, 800, 450 - GROUND_Y);
      ctx.fillStyle = '#ffd700';
      const lineScroll = cameraX % 100;
      for (let i = 0; i < 10; i++) ctx.fillRect((i * 100) - lineScroll, GROUND_Y + 60, 50, 5);

      for (let i = collectibles.length - 1; i >= 0; i--) {
        const c = collectibles[i];
        if (c.collected) continue;
        const screenX = c.worldX - cameraX;
        if (screenX < -30) { collectibles.splice(i, 1); continue; }

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd700';
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#ffd700';
        
        ctx.beginPath();
        ctx.arc(screenX + 15, c.worldY + 15, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX + 12, c.worldY + 15); ctx.lineTo(screenX + 2, c.worldY + 8);
        ctx.moveTo(screenX + 12, c.worldY + 15); ctx.lineTo(screenX + 0, c.worldY + 15);
        ctx.moveTo(screenX + 12, c.worldY + 15); ctx.lineTo(screenX + 2, c.worldY + 22);
        ctx.moveTo(screenX + 12, c.worldY + 15); ctx.lineTo(screenX + 6, c.worldY + 26);
        ctx.moveTo(screenX + 18, c.worldY + 15); ctx.lineTo(screenX + 28, c.worldY + 8);
        ctx.moveTo(screenX + 18, c.worldY + 15); ctx.lineTo(screenX + 30, c.worldY + 15);
        ctx.moveTo(screenX + 18, c.worldY + 15); ctx.lineTo(screenX + 28, c.worldY + 22);
        ctx.moveTo(screenX + 18, c.worldY + 15); ctx.lineTo(screenX + 24, c.worldY + 26);
        ctx.stroke();
        ctx.shadowBlur = 0;

        const playerScreenX = playerWorldX - cameraX;
        if (
          playerScreenX < screenX + 30 && playerScreenX + 40 > screenX &&
          playerWorldY < c.worldY + 30 && playerWorldY + 40 > c.worldY
        ) {
          c.collected = true;
          score += 100;
          playSound('collect');
        }
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        const screenX = obs.worldX - cameraX;
        if (screenX < -obs.width) { obstacles.splice(i, 1); continue; }
        
        if (obs.type === 'tentacle') {
          ctx.fillStyle = '#666677';
          const obsY = GROUND_Y + 40 - obs.height;
          ctx.fillRect(screenX, obsY, obs.width, obs.height);
          ctx.fillStyle = '#9999aa';
          ctx.fillRect(screenX + 8, obsY, 4, obs.height);
        } else {
          ctx.fillStyle = obs.type === 'hydrant' ? '#ff3333' : '#666677';
          const obsY = GROUND_Y + 40 - obs.height;
          ctx.fillRect(screenX, obsY, obs.width, obs.height);
        }
        
        const obsY = GROUND_Y + 40 - obs.height;
        const playerScreenX = playerWorldX - cameraX;
        if (
          playerScreenX < screenX + obs.width && playerScreenX + 40 > screenX &&
          playerWorldY < obsY + obs.height && playerWorldY + 40 > obsY
        ) {
          takeDamage();
        }
      }

      if (activeVillain) {
        if (activeVillain === 'goblin') {
          if (goblinLoaded) ctx.drawImage(goblinImg, bossScreenX, bossScreenY, 50, 50);
          ctx.fillStyle = '#666677';
          ctx.fillRect(bossScreenX - 10, bossScreenY + 45, 70, 10);
        } else if (activeVillain === 'hobgoblin') {
          if (hobgoblinLoaded) ctx.drawImage(hobgoblinImg, bossScreenX, bossScreenY, 50, 50);
          ctx.fillStyle = '#cc5500';
          ctx.fillRect(bossScreenX - 10, bossScreenY + 45, 70, 10);
        } else if (activeVillain === 'docock') {
          if (docOckLoaded) ctx.drawImage(docOckImg, bossScreenX, bossScreenY, 60, 60);
          ctx.strokeStyle = '#888899';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(bossScreenX + 20, bossScreenY + 20); ctx.lineTo(bossScreenX - 30, bossScreenY - 40);
          ctx.moveTo(bossScreenX + 20, bossScreenY + 20); ctx.lineTo(bossScreenX + 70, bossScreenY - 40);
          ctx.moveTo(bossScreenX + 20, bossScreenY + 40); ctx.lineTo(bossScreenX - 20, bossScreenY + 90);
          ctx.moveTo(bossScreenX + 20, bossScreenY + 40); ctx.lineTo(bossScreenX + 60, bossScreenY + 90);
          ctx.stroke();
        } else if (activeVillain === 'scorpion') {
          if (scorpionLoaded) ctx.drawImage(scorpionImg, bossScreenX, bossScreenY, 70, 70);
        } else if (activeVillain === 'carnage') {
          if (carnageLoaded) ctx.drawImage(carnageImg, bossScreenX, bossScreenY, 50, 50);
          // Carnage tendrils
          ctx.strokeStyle = '#990000';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(bossScreenX + 25, bossScreenY + 25); ctx.lineTo(bossScreenX + 50 + Math.random() * 30, bossScreenY - Math.random() * 30);
          ctx.moveTo(bossScreenX + 25, bossScreenY + 25); ctx.lineTo(bossScreenX - Math.random() * 30, bossScreenY + 50 + Math.random() * 30);
          ctx.stroke();
        }
        
        // Health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(bossScreenX - 10, bossScreenY - 20, 60, 6);
        ctx.fillStyle = '#00ff00';
        const maxH = activeVillain === 'goblin' ? 3 : (activeVillain === 'docock' ? 5 : (activeVillain === 'carnage' ? 6 : (activeVillain === 'hobgoblin' ? 4 : 4)));
        ctx.fillRect(bossScreenX - 10, bossScreenY - 20, (activeVillainHealth / maxH) * 60, 6);
      }

      for (const p of attackProjectiles) {
        ctx.fillStyle = activeCharacterConfig.webColor;
        ctx.beginPath();
        ctx.arc(p.worldX - cameraX, p.worldY, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = activeCharacterConfig.glowColor;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const p of projectiles) {
        const px = p.worldX - cameraX;
        ctx.beginPath();
        ctx.arc(px + 10, p.worldY + 10, 10, 0, Math.PI*2);
        if ((p as any).isAcid) {
          ctx.fillStyle = '#33cc33';
          ctx.fill();
        } else if ((p as any).isSymbiote) {
          ctx.fillStyle = '#990000';
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.fillRect(px + 8, p.worldY - 5, 4, 6);
        } else {
          ctx.fillStyle = '#ff6600';
          ctx.fill();
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(px + 8, p.worldY - 5, 4, 6);
        }
      }

      const playerScreenX = playerWorldX - cameraX;

      if (isSwinging && !isGameOver) {
        const anchorScreenX = anchorWorldX - cameraX;
        ctx.beginPath();
        ctx.moveTo(playerScreenX + 20, playerWorldY + 20);
        ctx.lineTo(anchorScreenX, anchorWorldY);
        ctx.lineWidth = 3;
        ctx.strokeStyle = activeCharacterConfig.webColor;
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = activeCharacterConfig.glowColor;
        ctx.stroke();
      }

      if (isZiplining && !isGameOver) {
        const anchorScreenX = ziplineAnchorWorldX - cameraX;
        ctx.beginPath();
        ctx.moveTo(playerScreenX + 20, playerWorldY + 20);
        ctx.lineTo(anchorScreenX, ziplineAnchorWorldY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = activeCharacterConfig.webColor;
        ctx.stroke();
      }

      const activeHeroAsset = heroImages[selectedCharacter];
      if (activeHeroAsset && activeHeroAsset.loaded) {
        if (invincibilityTimer <= 0 || Math.floor(time / 100) % 2 === 0) {
          ctx.drawImage(activeHeroAsset.img, playerScreenX, playerWorldY, 40, 40);
        }
      } else {
        ctx.fillStyle = activeCharacterConfig.fallbackFill;
        ctx.fillRect(playerScreenX, playerWorldY, 40, 40);
        ctx.fillStyle = activeCharacterConfig.accentColor;
        ctx.fillRect(playerScreenX + 25, playerWorldY + 8, 12, 10);
      }
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  });
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<div class="game-container">
  <div class="hud">
    <div class="health">
      {#each Array(playerHealth) as _}❤️{/each}
    </div>
    <div class="score">{scoreMessage}</div>
    {#if activeVillain}
      <div class="boss-warning">WARNING: {activeVillain.toUpperCase()}!</div>
    {/if}
  </div>

  <button
    class="settings-hud-btn"
    type="button"
    onclick={() => { if (isPlaying && !isGameOver) isPaused = true; showSettings = true; }}
    aria-label="Open Settings"
  >
    ⚙️
  </button>
  
  <canvas 
    bind:this={canvas} 
    width="800" 
    height="450"
    onpointerdown={handlePointerDown}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    style="touch-action: none;"
  ></canvas>

  {#if isPlaying && !isGameOver && !isPaused && !showSettings}
    <div class="mobile-controls" aria-label="Action controls">
      <button 
        type="button" 
        class="mobile-btn zipline-btn" 
        onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); triggerZipline(); }}
        onpointerup={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        aria-label="Zipline Jump"
      >
        <span class="btn-icon">⚡</span>
        <span class="btn-text">ZIPLINE</span>
      </button>
      <button 
        type="button" 
        class="mobile-btn shoot-btn {activeVillain ? 'target-active' : ''}" 
        onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); shootWeb(); }}
        onpointerup={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        aria-label="Shoot Web"
      >
        <span class="btn-icon">🕸️</span>
        <span class="btn-text">SHOOT</span>
      </button>
    </div>
  {/if}
  
  {#if !isPlaying && !isGameOver && !showSettings}
    <div class="overlay">
      <h1>Spidey Web Runner</h1>

      <button
        type="button"
        class="hero-preview-badge"
        style="--hero-border: {activeCharacterConfig.accentColor}; --hero-glow: {activeCharacterConfig.glowColor};"
        onclick={() => showSettings = true}
      >
        <img src="{base}/{activeCharacterConfig.imageSrc}" alt={activeCharacterConfig.heroName} class="badge-avatar" />
        <div class="badge-info">
          <div class="badge-title">{activeCharacterConfig.heroName}</div>
          <div class="badge-sub">{activeCharacterConfig.name} • Tap to Change Hero</div>
        </div>
      </button>

      <p class="instructions">
        <strong>TAP / HOLD</strong> to Jump & Swing!<br>
        <strong>🕸️ SHOOT</strong> (or &rarr; / Swipe Right) to Attack!<br>
        <strong>⚡ ZIPLINE</strong> (or &uarr; / Swipe Up) to Zip to Roof!
      </p>
      
      <div class="action-btn-row">
        <button class="start-btn" onclick={startGame}>Start Game</button>
        <button class="settings-menu-btn" onclick={() => showSettings = true}>⚙️ Settings</button>
      </div>
    </div>
  {:else if isGameOver && !showSettings}
    <div class="overlay game-over">
      <h1>Game Over!</h1>
      <p class="instructions">You scored {Math.floor(score)} points with {activeCharacterConfig.heroName}</p>
      <div class="action-btn-row">
        <button class="start-btn" onclick={startGame}>Try Again</button>
        <button class="settings-menu-btn" onclick={() => showSettings = true}>⚙️ Settings</button>
      </div>
    </div>
  {:else if isPaused && !showSettings}
    <div class="overlay pause-menu">
      <h1>Paused</h1>
      <p class="instructions">Take a breather, {activeCharacterConfig.heroName}!</p>
      <div class="action-btn-row">
        <button class="start-btn" onclick={() => isPaused = false}>Resume</button>
        <button class="settings-menu-btn" onclick={() => showSettings = true}>⚙️ Settings</button>
      </div>
    </div>
  {/if}

  {#if showSettings}
    <SettingsModal
      {selectedCharacter}
      {difficulty}
      {soundEnabled}
      onSelectCharacter={setCharacter}
      onChangeDifficulty={setDifficulty}
      onToggleSound={toggleSound}
      onClose={() => showSettings = false}
    />
  {/if}
</div>

<style>
  .game-container {
    position: relative;
    width: 100%;
    max-width: 800px;
    aspect-ratio: 16 / 9;
    background: var(--venom-black);
    border: 4px solid var(--spidey-blue);
    border-radius: 12px;
    box-shadow: 0 0 20px rgba(0, 77, 207, 0.4);
    overflow: hidden;
  }
  
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
  }

  .hud {
    position: absolute;
    top: 15px;
    left: 15px;
    color: white;
    font-size: 28px;
    font-weight: bold;
    text-shadow: 3px 3px 0 var(--venom-black);
    z-index: 10;
  }

  .settings-hud-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 24px;
    background: rgba(17, 17, 22, 0.7);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 15;
    transition: transform 0.15s, border-color 0.15s, background 0.15s;
    padding: 0;
  }

  .settings-hud-btn:hover {
    transform: scale(1.1) rotate(20deg);
    border-color: var(--electro-yellow);
    background: rgba(17, 17, 22, 0.95);
  }

  .boss-warning {
    color: #ff3333;
    font-size: 24px;
    animation: flash 1s infinite alternate;
  }
  
  @keyframes flash {
    from { opacity: 1; }
    to { opacity: 0.5; }
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: var(--glass-bg);
    backdrop-filter: blur(6px);
    z-index: 20;
    text-align: center;
    padding: 20px;
    box-sizing: border-box;
  }

  .pause-menu { background: rgba(17, 17, 22, 0.85); }
  .game-over { background: rgba(230, 0, 0, 0.25); border: 5px solid var(--spidey-red); }

  h1 {
    font-size: 44px;
    color: var(--electro-yellow);
    text-shadow: 3px 3px 0 var(--venom-black), 0 0 15px rgba(255, 215, 0, 0.5);
    margin-bottom: 8px;
  }
  
  .game-over h1 { color: white; text-shadow: 3px 3px 0 var(--spidey-red); }

  .hero-preview-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(24, 24, 36, 0.85);
    border: 2px solid var(--hero-border);
    box-shadow: 0 0 15px var(--hero-glow);
    padding: 8px 18px;
    border-radius: 30px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .hero-preview-badge:hover {
    transform: scale(1.05);
  }

  .badge-avatar {
    width: 38px;
    height: 38px;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
  }

  .badge-info {
    text-align: left;
  }

  .badge-title {
    font-size: 16px;
    font-weight: 800;
    color: white;
  }

  .badge-sub {
    font-size: 11px;
    color: #ffd700;
  }

  .instructions {
    font-size: 18px;
    color: white;
    text-shadow: 2px 2px 0 var(--venom-black);
    margin-bottom: 16px;
    line-height: 1.4;
  }

  .action-btn-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .start-btn {
    padding: 14px 36px;
    font-size: 26px;
    font-weight: 900;
    color: white;
    background: var(--spidey-red);
    border: 3px solid white;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 5px 0 var(--spidey-blue);
    transition: transform 0.1s, box-shadow 0.1s;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .settings-menu-btn {
    padding: 14px 22px;
    font-size: 20px;
    font-weight: 800;
    color: white;
    background: #2b2b3d;
    border: 3px solid #555577;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 5px 0 #181824;
    transition: transform 0.1s, box-shadow 0.1s;
  }

  .settings-menu-btn:hover {
    border-color: var(--electro-yellow);
  }
  
  button:active {
    transform: translateY(4px);
    box-shadow: none !important;
  }

  /* Mobile On-Screen Action Controls */
  .mobile-controls {
    position: absolute;
    right: 18px;
    bottom: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    z-index: 15;
    user-select: none;
    touch-action: none;
    pointer-events: auto;
  }

  .mobile-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 50%;
    cursor: pointer;
    user-select: none;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
    backdrop-filter: blur(8px);
    transition: transform 0.08s ease, box-shadow 0.12s ease, filter 0.12s ease;
    padding: 0;
  }

  .shoot-btn {
    background: radial-gradient(circle at 35% 35%, #ff3333, #aa0000);
    border: 3px solid #ff7777;
    box-shadow: 0 4px 14px rgba(230, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.4);
    color: white;
  }

  .shoot-btn.target-active {
    border-color: #ffff00;
    box-shadow: 0 0 16px #ff3333, inset 0 0 10px #ffff00;
    animation: pulse-shoot 0.8s infinite alternate ease-in-out;
  }

  @keyframes pulse-shoot {
    0% { transform: scale(1); filter: drop-shadow(0 0 2px #ff4444); }
    100% { transform: scale(1.1); filter: drop-shadow(0 0 12px #ffff00); }
  }

  .zipline-btn {
    background: radial-gradient(circle at 35% 35%, #0066ff, #002b80);
    border: 3px solid #ffd700;
    box-shadow: 0 4px 14px rgba(0, 77, 207, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.4);
    color: white;
  }

  .btn-icon {
    font-size: 26px;
    line-height: 1;
    margin-bottom: 2px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }

  .btn-text {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9);
  }

  .mobile-btn:active {
    transform: scale(0.9) !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5) !important;
  }

  @media (max-width: 600px) {
    .overlay {
      padding: 10px;
    }
    h1 {
      font-size: 26px;
      margin-bottom: 4px;
    }
    .hero-preview-badge {
      padding: 4px 12px;
      margin-bottom: 8px;
      gap: 8px;
    }
    .badge-avatar {
      width: 28px;
      height: 28px;
    }
    .badge-title {
      font-size: 13px;
    }
    .badge-sub {
      font-size: 10px;
    }
    .instructions {
      font-size: 13px;
      margin-bottom: 10px;
      line-height: 1.3;
    }
    .start-btn {
      padding: 8px 20px;
      font-size: 18px;
    }
    .settings-menu-btn {
      padding: 8px 14px;
      font-size: 15px;
    }
    .mobile-controls {
      right: 12px;
      bottom: 12px;
      gap: 10px;
    }
    .mobile-btn {
      width: 58px;
      height: 58px;
    }
    .btn-icon {
      font-size: 22px;
    }
    .btn-text {
      font-size: 9px;
    }
  }
</style>
