# Road Rage 🧟🚙

A fast-paced, comedic 60-second iPhone game. You drive a diesel 4×4 in
first-person view and plough through hordes of slow-moving zombies. Points are
awarded as **cakes and coffees**. No blood, no gore — pure cartoon physics and
stress relief.

---

## Gameplay Loop

| Detail | Value |
|---|---|
| Session length | **60 seconds** |
| Zombie speed | **15 mph (6.7 m/s)** |
| Zombie direction | ~60% same as player, ~40% oncoming |
| Spawn pattern | Solo, pairs, or groups of 4–6 |
| Scoring | +1 point per zombie; combo bonus (+3) for 3+ hits within 2 s |
| Point display | 🍰 ☕ icons in HUD with running total |
| On hit | Ragdoll launch + spin + tumble + slide — full comedy physics |
| End of game | Score, rank, leaderboard (local, top 20) |

---

## Project Setup (Unity 2022.3 LTS)

### 1 — Open in Unity

```
File → Open Project → select the `road-rage/` folder
```

Accept the Unity version prompt. The Package Manager will automatically
restore packages listed in `Packages/manifest.json`.

### 2 — Create the Main Scene

1. **File → New Scene** → save as `Assets/Scenes/Game.unity`
2. Set Build Target: **File → Build Settings → iOS**

### 3 — Required GameObjects

| GameObject | Components |
|---|---|
| `GameManager` | `GameManager`, `LeaderboardManager`, `ZombieSpawner` |
| `Player` | `PlayerVehicle`, `VehicleCollision`, `Rigidbody`, `BoxCollider` |
| `MainCamera` | `Camera` — child of `Player`, positioned at eye level (e.g. 0, 1.5, 0.3) |
| `RoadGenerator` | `RoadGenerator` |
| `UICanvas` | `Canvas` (Screen Space – Overlay), `UIManager` |

### 4 — Required Prefabs

| Prefab | Notes |
|---|---|
| **Road segment** | Flat plane ~20 m long with road texture + kerbs. Assign to `RoadGenerator.roadSegmentPrefab`. |
| **Zombie** | Humanoid model with Unity ragdoll rig (Rigidbody on each bone, root Collider for walking). Assign `ZombieController`. Must have an `Animator` component. |
| **Hit VFX** | Particle system — stars, cakes, confetti. Assign to `VehicleCollision.hitVFXPrefab`. |
| **Score Popup** | UI prefab (RectTransform + CanvasGroup + TMP). Assign `ScorePopup`. |
| **Leaderboard Entry** | Horizontal layout row. Assign `LeaderboardEntryUI`. |

### 5 — Recommended Free Assets (Unity Asset Store)

- **Zombie character pack** — search "zombie free" on the Asset Store for a
  rigged humanoid with a walk cycle and ragdoll.
- **Low-poly road kit** — search "low poly road" for a ready-made segment
  with lane markings and kerbs.
- **Cartoon hit VFX** — search "cartoon particle effects" for stars / impact
  bursts.
- **Engine SFX** — search "car engine loop" for a diesel rumble.

### 6 — iOS Build Settings

In **Player Settings → iOS**:

```
Bundle Identifier : com.yourname.roadrage
Target minimum iOS: 15.0
Architecture     : ARM64
```

Enable **Accelerometer** if you want tilt-based steering (swap touch input
in `PlayerVehicle.ReadInput()`).

---

## Script Architecture

```
Assets/Scripts/
├── Core/
│   ├── GameManager.cs          # Timer, scoring, game state, events
│   └── LeaderboardManager.cs   # Persist & retrieve top-20 scores (PlayerPrefs + JSON)
│
├── Vehicle/
│   ├── PlayerVehicle.cs        # Forward movement + left/right touch steering
│   └── VehicleCollision.cs     # Detects zombie hits, triggers ragdoll + score
│
├── Zombies/
│   ├── ZombieController.cs     # Walk AI + ragdoll hit reaction
│   └── ZombieSpawner.cs        # Procedural spawn (solo / pair / group, both directions)
│
├── Environment/
│   └── RoadGenerator.cs        # Infinite road via object-pooled segments + roadside props
│
└── UI/
    ├── UIManager.cs            # HUD, game-over panel, name entry, leaderboard screen
    ├── ScorePopup.cs           # Animated floating "+N ☕" label on each hit
    └── LeaderboardEntryUI.cs   # Single leaderboard row (rank, name, score, date)
```

### Event Flow

```
GameManager ──OnZombieHit──► UIManager (spawn popup)
            ──OnScoreChanged► UIManager (refresh HUD)
            ──OnTimeChanged──► UIManager (timer bar)
            ──OnGameOver─────► UIManager (show panel)
                               LeaderboardManager (save score)

VehicleCollision ──RegisterHit──► GameManager
                 ──TakeHit──────► ZombieController (ragdoll)
```

---

## Extending the Game

| Idea | Where to change |
|---|---|
| Add tilt steering | `PlayerVehicle.ReadInput()` — use `Input.acceleration.x` |
| Different zombie types (fast / slow) | Subclass `ZombieController` or expose `walkSpeed` on prefab |
| Roadside hazards (potholes) | Add to `RoadGenerator.SpawnPropsForSegment()` |
| Sound effects | Assign clips in `VehicleCollision.bumpSounds` |
| Background music | Add `AudioSource` on `GameManager` GO |
| Game Center leaderboard | Replace `LeaderboardManager` persistence with Apple Game Center API |

---

## License

MIT — do whatever you like with the code.
