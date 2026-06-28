<script lang="ts">
  import { onMount } from 'svelte';

  // UI state
  let canvas = $state<HTMLCanvasElement | null>(null);
  let score = $state(0);
  let isPlaying = $state(false);
  let isPaused = $state(false);
  let isGameOver = $state(false);

  let scoreMessage = $derived(`Score: ${Math.floor(score)}`);

  // Game constants
  const GRAVITY = 1800;
  const JUMP_FORCE = -700;
  const GAME_SPEED = 400;
  const GROUND_Y = 350;

  // Physics state (Non-reactive for performance)
  let playerWorldX = 100;
  let playerWorldY = GROUND_Y;
  let playerVx = GAME_SPEED;
  let playerVy = 0;
  let cameraX = 0;
  
  let isSwinging = false;
  let anchorWorldX = 0;
  let anchorWorldY = 0;
  let webLength = 0;
  let isActionPressed = false;
  
  let touchStartX = 0;

  interface Obstacle { worldX: number; width: number; height: number; type: 'hydrant' | 'trash'; }
  let obstacles: Obstacle[] = [];
  let nextObstacleWorldX = 800;

  interface Collectible { worldX: number; worldY: number; collected: boolean; }
  let collectibles: Collectible[] = [];
  let nextCollectibleWorldX = 600;

  // Boss state
  let goblinActive = false;
  let goblinHealth = 3;
  let goblinPhase = 0;
  let goblinDefeated = false;
  
  interface Projectile { worldX: number; worldY: number; vx: number; vy?: number; isBomb: boolean; }
  let projectiles: Projectile[] = [];
  let attackProjectiles: Projectile[] = [];

  // Pseudo-random hash for varied but persistent heights
  const hash = (n: number) => { let s = Math.sin(n) * 43758.5453123; return s - Math.floor(s); };
  const getBuildingHeight = (index: number) => 280 + hash(index) * 140;
  const getMidBuildingHeight = (index: number) => 300 + hash(index + 100) * 120;

  function triggerAction() {
    if (isGameOver || !isPlaying) { startGame(); return; }
    if (isPaused) return;

    if (playerWorldY >= GROUND_Y - 5) {
      playerVy = JUMP_FORCE;
      isSwinging = false;
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
    if (isPlaying && !isGameOver && goblinActive) {
      attackProjectiles.push({ 
        worldX: playerWorldX + 20, 
        worldY: playerWorldY + 10, 
        vx: 1200, 
        isBomb: false 
      });
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!isActionPressed) { isActionPressed = true; triggerAction(); }
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      shootWeb();
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
    if (!isActionPressed) { isActionPressed = true; triggerAction(); }
  }

  function handlePointerUp(e: PointerEvent) {
    e.preventDefault();
    const dx = e.clientX - touchStartX;
    if (dx > 40) shootWeb();
    
    isActionPressed = false;
    releaseAction();
  }

  function startGame() {
    isPlaying = true;
    isPaused = false;
    isGameOver = false;
    score = 0;
    
    playerWorldX = 100;
    playerWorldY = GROUND_Y;
    playerVx = GAME_SPEED;
    playerVy = 0;
    cameraX = 0;
    isSwinging = false;
    obstacles = [];
    nextObstacleWorldX = 800;
    collectibles = [];
    nextCollectibleWorldX = 600;
    
    goblinActive = false;
    goblinHealth = 3;
    goblinDefeated = false;
    projectiles = [];
    attackProjectiles = [];
  }

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const spideyImg = new Image();
    spideyImg.src = '/spidey.svg';
    let imgLoaded = false;
    spideyImg.onload = () => imgLoaded = true;
    
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animationFrameId = requestAnimationFrame(loop);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (isPaused || !isPlaying || isGameOver) return;

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
      
      const targetCameraX = playerWorldX - 150;
      cameraX += GAME_SPEED * dt;
      if (targetCameraX > cameraX) cameraX += (targetCameraX - cameraX) * 5 * dt;
      score += (cameraX * dt) / 10;
      
      if (playerWorldX < cameraX - 40) {
        isPlaying = false;
        isGameOver = true;
      }

      // Boss logic
      if (!goblinDefeated && score >= 1000 && !goblinActive) {
        goblinActive = true;
        goblinHealth = 3;
      }

      let goblinScreenX = 650;
      let goblinScreenY = 0;
      
      if (goblinActive) {
        goblinPhase += dt * 3;
        goblinScreenY = 150 + Math.sin(goblinPhase) * 100;
        
        if (Math.random() < 0.015) {
           projectiles.push({
             worldX: cameraX + goblinScreenX,
             worldY: goblinScreenY + 20,
             vx: Math.random() * -100 - 100,
             vy: -200 + Math.random() * -200,
             isBomb: true
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
          goblinActive && 
          p.worldX > cameraX + goblinScreenX && p.worldX < cameraX + goblinScreenX + 50 &&
          p.worldY > goblinScreenY && p.worldY < goblinScreenY + 60
        ) {
           goblinHealth -= 1;
           attackProjectiles.splice(i, 1);
           if (goblinHealth <= 0) {
              goblinActive = false;
              goblinDefeated = true;
              score += 1000;
           }
        }
      }

      // Enemy projectiles (bombs)
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.worldX += p.vx * dt;
        p.vy = (p.vy || 0) + GRAVITY * 0.4 * dt; // slight arc
        p.worldY += p.vy * dt;
        
        if (p.worldX < cameraX - 50 || p.worldY > GROUND_Y + 50) {
          projectiles.splice(i, 1);
          continue;
        }
        
        if (
          p.worldX < playerWorldX + 35 && p.worldX + 15 > playerWorldX &&
          p.worldY < playerWorldY + 35 && p.worldY + 15 > playerWorldY
        ) {
          isPlaying = false;
          isGameOver = true;
          ctx.fillStyle = 'rgba(230, 0, 0, 0.5)';
          ctx.fillRect(0, 0, 800, 450);
          break;
        }
      }

      // Spawning obstacles (only if goblin is not active, else he throws bombs)
      if (!goblinActive && cameraX > nextObstacleWorldX - 800) {
        obstacles.push({
          worldX: nextObstacleWorldX, 
          width: Math.random() > 0.5 ? 25 : 35,
          height: Math.random() > 0.5 ? 40 : 50, 
          type: Math.random() > 0.5 ? 'hydrant' : 'trash'
        });
        nextObstacleWorldX += 400 + Math.random() * 500;
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
      ctx.fillStyle = '#1a1a2e';
      for (let i = 0; i < 9; i++) {
        const idx = startMidIdx + i;
        const h = getMidBuildingHeight(idx);
        ctx.fillRect((idx * 120) - (midScroll % 120), GROUND_Y + 50 - h, 110, h);
      }

      const startFgIdx = Math.floor(cameraX / 200);
      for (let i = 0; i < 6; i++) {
        const idx = startFgIdx + i;
        const h = getBuildingHeight(idx);
        const screenX = idx * 200 - cameraX;
        const y = GROUND_Y + 50 - h;
        ctx.fillStyle = '#2d2d44';
        ctx.fillRect(screenX, y, 185, h);
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
        }
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        const screenX = obs.worldX - cameraX;
        if (screenX < -obs.width) { obstacles.splice(i, 1); continue; }
        
        ctx.fillStyle = obs.type === 'hydrant' ? '#ff3333' : '#666677';
        const obsY = GROUND_Y + 40 - obs.height;
        ctx.fillRect(screenX, obsY, obs.width, obs.height);
        
        const playerScreenX = playerWorldX - cameraX;
        if (
          playerScreenX < screenX + obs.width && playerScreenX + 40 > screenX &&
          playerWorldY < obsY + obs.height && playerWorldY + 40 > obsY
        ) {
          isPlaying = false;
          isGameOver = true;
          ctx.fillStyle = 'rgba(230, 0, 0, 0.5)';
          ctx.fillRect(0, 0, 800, 450);
          break;
        }
      }

      if (goblinActive) {
        ctx.fillStyle = '#666677';
        ctx.fillRect(goblinScreenX - 10, goblinScreenY + 40, 70, 10);
        ctx.fillStyle = '#00aa00';
        ctx.fillRect(goblinScreenX, goblinScreenY, 50, 40);
        ctx.fillStyle = '#660066';
        ctx.fillRect(goblinScreenX + 5, goblinScreenY - 15, 30, 20);
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(goblinScreenX + 5, goblinScreenY - 10, 10, 5);
        
        // Health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(goblinScreenX, goblinScreenY - 30, 50, 6);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(goblinScreenX, goblinScreenY - 30, (goblinHealth / 3) * 50, 6);
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
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(px + 10, p.worldY + 10, 10, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(px + 8, p.worldY - 5, 4, 6);
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

      if (imgLoaded) {
        ctx.drawImage(spideyImg, playerScreenX, playerWorldY, 40, 40);
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
    <div class="score">{scoreMessage}</div>
    {#if goblinActive}
      <div class="boss-warning">WARNING: GREEN GOBLIN!</div>
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
      <p class="instructions">HOLD SPACE or TAP to Swing!<br>RIGHT ARROW or SWIPE RIGHT to Shoot Web!</p>
      <button onclick={startGame}>Start Game</button>
    </div>
  {:else if isGameOver}
    <div class="overlay game-over">
      <h1>Game Over!</h1>
      <p class="instructions">You scored {Math.floor(score)} points</p>
      <button onclick={startGame}>Try Again</button>
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
    margin-bottom: 30px;
    line-height: 1.5;
  }

  button {
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
