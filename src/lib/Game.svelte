<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';

  // UI state
  let canvas = $state<HTMLCanvasElement | null>(null);
  let score = $state(0);
  let isPlaying = $state(false);
  let isPaused = $state(false);
  let isGameOver = $state(false);

  let scoreMessage = $derived(`Score: ${Math.floor(score)}`);
  
  let difficulty = $state(2);
  let playerHealth = $state(3);
  let invincibilityTimer = 0;

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
    if (isPlaying && !isGameOver && activeVillain) {
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
    if (e.code === 'Space') { isActionPressed = false; releaseAction(); }
  }

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    if (!isActionPressed) { isActionPressed = true; triggerAction(); }
  }

  function handlePointerUp(e: PointerEvent) {
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
    
    const spideyImg = new Image();
    spideyImg.src = `${base}/spidey.svg`;
    let imgLoaded = false;
    spideyImg.onload = () => imgLoaded = true;

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
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.worldX - cameraX, p.worldY, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
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
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();
      }

      if (isZiplining && !isGameOver) {
        const anchorScreenX = ziplineAnchorWorldX - cameraX;
        ctx.beginPath();
        ctx.moveTo(playerScreenX + 20, playerWorldY + 20);
        ctx.lineTo(anchorScreenX, ziplineAnchorWorldY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      if (imgLoaded) {
        if (invincibilityTimer <= 0 || Math.floor(time / 100) % 2 === 0) {
          ctx.drawImage(spideyImg, playerScreenX, playerWorldY, 40, 40);
        }
      } else {
        ctx.fillStyle = '#e60000';
        ctx.fillRect(playerScreenX, playerWorldY, 40, 40);
        ctx.fillStyle = 'white';
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
  
  <canvas 
    bind:this={canvas} 
    width="800" 
    height="450"
    onpointerdown={handlePointerDown}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    style="touch-action: none;"
  ></canvas>
  
  {#if !isPlaying && !isGameOver}
    <div class="overlay">
      <h1>Spidey Web Runner</h1>
      <p class="instructions">HOLD SPACE or TAP to Swing!<br>RIGHT ARROW or SWIPE RIGHT to Shoot Web!<br>UP ARROW or SWIPE UP to Zipline Jump!</p>
      <div class="difficulty-select">
        <button class:active={difficulty === 1} onclick={() => difficulty = 1}>Easy</button>
        <button class:active={difficulty === 2} onclick={() => difficulty = 2}>Medium</button>
        <button class:active={difficulty === 3} onclick={() => difficulty = 3}>Hard</button>
      </div>
      <button class="start-btn" onclick={startGame}>Start Game</button>
    </div>
  {:else if isGameOver}
    <div class="overlay game-over">
      <h1>Game Over!</h1>
      <p class="instructions">You scored {Math.floor(score)} points</p>
      <div class="difficulty-select">
        <button class:active={difficulty === 1} onclick={() => difficulty = 1}>Easy</button>
        <button class:active={difficulty === 2} onclick={() => difficulty = 2}>Medium</button>
        <button class:active={difficulty === 3} onclick={() => difficulty = 3}>Hard</button>
      </div>
      <button class="start-btn" onclick={startGame}>Try Again</button>
    </div>
  {:else if isPaused}
    <div class="overlay pause-menu">
      <h1>Paused</h1>
      <p class="instructions">Take a breather, Spidey!</p>
      <button onclick={() => isPaused = false}>Resume</button>
    </div>
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
  }

  .pause-menu { background: rgba(17, 17, 22, 0.8); }
  .game-over { background: rgba(230, 0, 0, 0.2); border: 5px solid var(--spidey-red); }

  h1 {
    font-size: 48px;
    color: var(--electro-yellow);
    text-shadow: 3px 3px 0 var(--venom-black), 0 0 15px rgba(255, 215, 0, 0.5);
    margin-bottom: 10px;
  }
  
  .game-over h1 { color: white; text-shadow: 3px 3px 0 var(--spidey-red); }

  .instructions {
    font-size: 20px;
    color: white;
    text-shadow: 2px 2px 0 var(--venom-black);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .difficulty-select {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  .difficulty-select button {
    padding: 10px 20px;
    font-size: 20px;
    background: #333;
    border: 2px solid #555;
    box-shadow: none;
  }
  
  .difficulty-select button.active {
    background: var(--spidey-blue);
    border-color: white;
    box-shadow: 0 0 15px var(--spidey-blue);
  }

  .start-btn {
    padding: 15px 40px;
    font-size: 28px;
    font-weight: 900;
    color: white;
    background: var(--spidey-red);
    border: 4px solid white;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 6px 0 var(--spidey-blue);
    transition: transform 0.1s, box-shadow 0.1s;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  button:active {
    transform: translateY(6px);
    box-shadow: 0 0 0 var(--spidey-blue);
  }
</style>
