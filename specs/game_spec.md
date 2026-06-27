# Spider-Man Web Runner - Game Specification

This document details the features, controls, mechanics, and visual design for the Spider-Man kids web game.

---

## 🎮 Overview

A fast-paced, side-scrolling runner where Spider-Man automatically runs from left to right along a street backdrop. The goal is to traverse as far as possible, collect spiders/tokens, and dodge obstacles using jump and web-swing mechanics.

---

## 🕹️ Controls

Designed to be ultra-simple for kids and functional on both desktop (keyboard/mouse) and mobile (touch):

| Action | Desktop Input | Mobile/Touch Input |
|---|---|---|
| **Jump** | `Spacebar` / Left Click | Tap Screen |
| **Web-Swing** | Hold `Spacebar` / Hold Left Click | Hold Tap Screen |

### Control Mechanics:
1. **Jump**: Pressing the jump input launches Spider-Man into the air.
2. **Swing**: While in mid-air, holding the input fires a web line to the nearest building roof hook and swings Spider-Man forward in a pendulum motion. Releasing the input detaches the web and flings Spider-Man forward.

---

## ⚙️ Core Mechanics

1. **Auto-Run**: Constant sideways velocity to the right. The camera and world scroll continuously.
2. **Web-Swinging Physics**:
   - Web attachment points (anchors) automatically target the roof edges of buildings overhead.
   - While swinging, apply pendulum physics (gravity + tension) to determine velocity.
3. **Obstacles**:
   - Ground obstacles (e.g., trash cans, hydrants, puddles) - must be jumped over.
   - Airborne obstacles (e.g., billboards, flying drones) - must be swung under or jumped over.
4. **Collectibles**:
   - Golden Spiders to increase score.
   - Web fluid refills.

---

## 🎨 Visuals & Sound (Kids Focus)

- **Art Style**: Cartoonish, vibrant, and clean. Uses bright neon colors for a premium look.
- **Layers (Parallax)**:
  - **Foreground**: Street level containing Spider-Man, obstacles, and collectibles.
  - **Midground**: City buildings with clear anchor points highlighted in neon blue.
  - **Background**: Distant skyline and sky (sunset or night with stars).
- **Feedback Loops**:
  - Web lines should be bright white/neon-blue and glow.
  - Sparkle effects when collecting items.
  - Friendly popup text ("Awesome!", "Great Job!", "Spidey Power!") on successful swing transitions.
- **Audio**: Upbeat cartoonish heroic music, web-shooting sound ("thwip!"), jump grunt, and item collection chime.

---

## 🛠️ Technical Implementation Strategy

- **Game Engine**: Custom 2D canvas engine powered by Svelte 5 and TypeScript.
- **Game State**: Managed via Svelte Runes (`$state`, `$derived`).
- **Physics**: Basic Euler integration for gravity and linear motion; rope constraint physics for web-swinging.
