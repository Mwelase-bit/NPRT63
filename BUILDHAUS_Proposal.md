# BUILDHAUS — Gamified Academic Productivity Application
### Sol Plaatje University

---

## Overview

BUILDHAUS (formerly developed under the working title *AetherDrift 2*) is a 3D productivity application that gamifies focus sessions through virtual castle and house construction. Students set a focus timer, and a customisable builder character constructs a building in stages while the timer runs. If the session is completed without interruption, the structure stands and rewards are earned. If interrupted, the building collapses. The application features a comprehensive progression system encompassing achievements, virtual coins, customisable characters, and multiple building types to unlock, thereby encouraging sustained academic focus.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend Architecture
- **Framework**: Pure React with CDN imports, no build system required
- **3D Rendering**: Three.js with React Three Fiber for declarative 3D scene management
- **Component Structure**: Modular React components for UI panels, 3D objects, and game logic
- **State Management**: React hooks with custom hooks for game state, timer, and rewards
- **Styling**: CSS with Bootstrap for UI components and custom CSS for game-specific styling

### Game Logic Architecture
- **Timer System**: JavaScript intervals with React state management for countdown functionality
- **Progress Tracking**: Stage-based house construction with percentage-based progress calculations
- **Reward System**: Multi-faceted coin and achievement system with streak bonuses and difficulty multipliers
- **Customisation System**: Character appearance system with unlockable items and gender options

### Data Management
- **Storage Strategy**: Browser localStorage for persistent game state, rewards, and settings
- **Data Structure**: JSON-based configuration files for house types, customisation options, and achievements
- **State Persistence**: Automatic saving of game progress with error handling for storage failures

### 3D Scene Architecture
- **Scene Management**: React Three Fiber Canvas with OrbitControls for camera movement
- **Asset Strategy**: Procedurally generated 3D geometry using Three.js primitives (no external 3D models)
- **Animation System**: CSS-based transitions and Three.js frame-based animations for building progression
- **Visual Style**: Low-poly aesthetic with bright colours and simple geometric shapes

### Game Mechanics Design
- **Focus Session Flow**: Timer-driven gameplay with interruption detection and consequence system
- **Progression System**: Experience-based unlocks with multiple progression tracks (buildings, customisations, achievements)
- **Economy System**: Coin-based virtual economy with dynamic pricing and bonus calculations
- **Achievement System**: Goal-based progression with different rarity tiers and reward structures

---

## External Dependencies

### Core Libraries
- **React 18**: Component-based UI framework loaded via CDN
- **Three.js**: 3D graphics library for WebGL rendering
- **React Three Fiber**: React renderer for Three.js scenes
- **React Three Drei**: Helper components and utilities for React Three Fiber
- **Babel Standalone**: In-browser JSX compilation for development

### UI and Styling
- **Bootstrap 5**: CSS framework for responsive UI components
- **Feather Icons**: Icon library for UI elements and achievements

### Browser APIs
- **localStorage**: Client-side data persistence for game state and progress
- **Date API**: Time calculations for streak tracking and session timing
- **setInterval/clearInterval**: Timer functionality for focus sessions

### Development Tools
- **Babel**: JSX transformation for React components in browser environment
- **No build system**: Direct browser execution with script tags for rapid development

---

## System Functionality Table

| Feature ID | Feature Name | Description |
|---|---|---|
| F1 | Focus Timer | A countdown timer that drives the virtual building construction session. |
| F2 | 3D Building Progression | Castle and house structures are built in phases as the focus session progresses. |
| F3 | Interruption Detection | Detecting clicks or touches during a session triggers an animated demolition sequence. |
| F4 | Reward System | Students earn virtual coins upon successful completion of focus sessions. |
| F5 | Streak Tracking | Daily usage streaks are tracked and rewarded with bonus coins at milestone intervals. |
| F6 | Achievement System | Goal-based achievements unlock automatically based on session count, time, or streak. |
| F7 | Builder Customisation | Students may customise their in-game character's appearance, clothing, and tools. |
| F8 | Shop Panel | An in-game store where earned coins may be spent on cosmetic items and building types. |
| F9 | Rewards Panel | A dashboard displaying daily progress, weekly challenges, and claimable coin rewards. |
| F10 | Profile Panel | Displays student statistics, achievement gallery, and village overview. |
| F11 | Community Panel | A social panel showing friends, leaderboards, and community challenges. |
| F12 | Daily Login Bonus | Students may claim a daily check-in coin reward upon opening the application. |
| F13 | Weekly Challenge | A weekly session-count goal that, when achieved, rewards the student with bonus coins. |
| F14 | Mystery Box | A gacha-style system where coins may be spent for a randomised reward. |
| F15 | Consumable Boosters | Single-use items (e.g., Focus Potion) that temporarily increase coin earnings. |
| **F16** | **Faculty-Based Leaderboards** | **During registration, users select their faculty, allowing BUILDHAUS to group students into academic communities. Weekly leaderboards rank students within each faculty according to total completed focus-session hours. Aggregate faculty rankings are also generated to support campus-wide interfaculty competition.** |

---

## 4. Faculty-Based Community System

### 4.1 Faculty Identification During Registration

To facilitate academic community formation, BUILDHAUS requires students to select their faculty upon initial registration. The following faculties, as constituted at Sol Plaatje University, are available for selection:

- Faculty of Natural and Applied Sciences
- Faculty of Education
- Faculty of Economic and Management Sciences (EMS)
- Faculty of Humanities

This classification serves a dual purpose: it organises users into structured academic communities and enables the system to generate faculty-specific analytics and performance comparisons. By situating students within their academic context, the application cultivates a sense of belonging and shared academic identity, which is critical to sustained engagement with the platform.

---

### 4.2 Faculty-Based Leaderboards

BUILDHAUS generates weekly leaderboards segmented by academic faculty. Each week, students are ranked according to the total number of completed focus-session hours accumulated within the application during that period. Rankings are presented within each faculty cohort, ensuring that comparisons are made among peers who share a common academic environment and workload profile.

This mechanism introduces structured peer comparison within a familiar academic community. Research in educational psychology indicates that peer visibility and normative comparison — particularly when contextualised within a relevant social group — can significantly enhance intrinsic motivation and sustained academic effort. Faculty-based leaderboards therefore serve not merely as a gamification feature, but as a pedagogically informed tool for promoting productive study behaviour.

---

### 4.3 Faculty Competition System

In addition to individual faculty leaderboards, BUILDHAUS introduces a campus-wide faculty competition feature. The system aggregates the total focus-session hours completed by all members of each faculty and publishes a weekly ranking that reflects which faculty, as a collective, has accumulated the most focused study time.

This interfaculty competition fosters a spirit of friendly academic rivalry and encourages collaborative productivity within each faculty. Students are motivated not only by personal advancement, but by a collective sense of responsibility to contribute to their faculty's standing. This design draws on principles of cooperative gamification, wherein shared goals and group accountability elevate individual performance across a community.

---

### 4.4 Social Visibility Within Faculties

BUILDHAUS enables students to view the study activity, virtual buildings, streaks, and achievement records of other students within their faculty. This social transparency reinforces the application's community dimension by allowing students to observe the progress of their peers, draw inspiration from high-performing members, and engage in informal social accountability.

This feature strengthens the social fabric of the application while maintaining academic relevance — interactions and comparisons occur within a community that shares the same courses, lectures, and academic pressures. The result is a socially enriched productivity environment that is simultaneously motivating and contextually appropriate.

---

## 5. Database Implications

The implementation of the faculty-based community system necessitates a modification to the existing data schema. Specifically, the **Users** table will be extended to include a `faculty` attribute, which will store the faculty selected by each student during registration. This attribute will serve as the primary grouping variable for all faculty-specific functionality, including leaderboard generation, interfaculty competition aggregation, and social visibility filters.

The inclusion of the `faculty` attribute enables the system to partition the student user base into academically meaningful cohorts, thereby supporting the generation of granular, context-aware analytics. These analytics can, in turn, be made available to academic administrators at Sol Plaatje University, offering institutional insight into faculty-level study patterns and engagement trends.

---

*BUILDHAUS — Empowering academic focus through gamified productivity.*
*Sol Plaatje University | Faculty of Natural and Applied Sciences*
