# BUILDHAUS — Phase 3: Interface Design, Database Design, and Technology Justification

### NPRT6330 Group Assignment 2026 | Sol Plaatje University

---

## Section 1: Screen Mock-ups and Descriptions

This section presents the key screens of the BUILDHAUS application. Each screen is accompanied by a description of its purpose, its main components, and the user actions it supports. Screenshots are included as placeholders to be replaced with actual application screenshots or Figma exports.

---

### Screen 1: Registration Screen

**Purpose:** This is the first screen a new student sees. It collects the details needed to create an account and place the student in their academic community.

**Main Components:**
- BUILDHAUS logo and tagline at the top
- Multi step registration flow (Name, Faculty, Credentials, Profile Details)
- Display name input field
- Faculty selector with emoji icons
- Email and Password fields
- Confirm Password field for validation
- Gender selector (Male, Female, Other)
- Student number input field (optional)
- Register button

**User Actions:** The student fills in their name and selects a faculty. They then provide an email and password, confirming the password to ensure accuracy. Finally, they select their gender and optional student number. The system validates all inputs and creates the account.

```
[ SCREENSHOT PLACEHOLDER — Registration Screen ]
```

---

### Screen 2: Login Screen

**Purpose:** Allows returning students to authenticate and access their saved progress, coins, and buildings.

**Main Components:**
- BUILDHAUS logo
- Email address input field
- Password input field
- Login button
- "Don't have an account? Register" link

**User Actions:** The student enters their email and password and taps Login. The system checks the credentials against the hashed password stored in the database and loads the personalised dashboard.

```
[ SCREENSHOT PLACEHOLDER — Login Screen ]
```

---

### Screen 3: Home Dashboard / Game Scene

**Purpose:** This is the main screen the student sees after logging in. It combines the 3D game world with quick access to all major features.

**Main Components:**
- 3D canvas showing the current building under construction or the completed village
- Animated builder character that walks and works during a focus session
- Navigation bar at the bottom with icons for Home, Study, Shop, Rewards, and Profile
- Coin balance and streak badge displayed at the top

**User Actions:** The student can look around the 3D scene, tap the timer button to start a session, or use the navigation bar to move between panels.

```
[ SCREENSHOT PLACEHOLDER — Home Dashboard / 3D Game Scene ]
```

---

### Screen 4: Focus Timer Panel

**Purpose:** Lets the student configure and launch a timed focus session.

**Main Components:**
- Preset duration buttons (25 min, 1 hour, 2 hours, 3 hours)
- Custom duration input field
- Estimated coin reward preview
- Start Session button
- Active session view with countdown timer and progress bar

**User Actions:** The student selects a duration and taps Start Session. The 3D building begins rising in stages. If the session is completed, rewards are awarded. If the student abandons the session, the building collapses.

```
[ SCREENSHOT PLACEHOLDER — Focus Timer Panel ]
```

---

### Screen 5: Study AI Panel

**Purpose:** A learning tool that allows students to paste study material and have the AI generate flashcard sets and quizzes.

**Main Components:**
- Large text area for pasting source material
- Generate Flashcards button
- Interactive flashcard viewer
- Start Quiz button
- Quiz interface with multiple choice questions

**User Actions:** The student pastes their notes and generates cards. They can then review the cards or take a quiz to earn extra coins based on their performance.

```
[ SCREENSHOT PLACEHOLDER — Study AI Panel ]
```

---

### Screen 6: Report Generation View

**Purpose:** Provides a formal summary of the student's academic focus progress.

**Main Components:**
- "Generate Report" button in the Profile panel
- Modal or Alert summary showing total focus time, success rate, and faculty ranking
- Detailed breakdown of sessions completed and failed

**User Actions:** The student taps the Generate Report button to see a summary of their study habits. This report is designed to be shared with academic advisors if required.

```
[ SCREENSHOT PLACEHOLDER — Report Generation View ]
```

---

### Screen 7: Admin / User Management Panel

**Purpose:** A panel for monitoring user accounts and system health, accessible through the Profile view.

**Main Components:**
- User table showing Student Name, Faculty, and Total Hours
- Management actions for each user
- System analytics summary

**User Actions:** Administrators can view all registered students, check their study progress, and manage accounts to ensure the platform is being used correctly.

```
[ SCREENSHOT PLACEHOLDER — Admin Management Panel ]
```

---

## Section 2: User Feedback and Design Iteration

This section documents feedback collected from students at Sol Plaatje University and the resulting design changes.

---

### Iteration 1: Registration Complexity

**Feedback received:** Users felt that a single long registration form was overwhelming. They also frequently made typos in their passwords without a way to double check.

**Change made:** We split the registration into four clear steps with a progress indicator at the top. We also added a "Confirm Password" field to ensure students enter their chosen password correctly.

```
[ SCREENSHOT PLACEHOLDER — Registration BEFORE (Single form) ]
[ SCREENSHOT PLACEHOLDER — Registration AFTER (Multi-step with Confirm Password) ]
```

**Summary of change:** "Users found the long form intimidating and made password typos, so we created a multi-step flow and added a confirm password field."

---

### Iteration 2: Gender Selection

**Feedback received:** The initial prototype only had male and female options, which some students felt was not inclusive enough.

**Change made:** We added an "Other" option to the gender selection in both the registration flow and the profile customization panel.

```
[ SCREENSHOT PLACEHOLDER — Profile BEFORE (Binary gender) ]
[ SCREENSHOT PLACEHOLDER — Profile AFTER (Inclusive gender options) ]
```

**Summary of change:** "Users requested more inclusive options, so we added an Other category to all gender selection menus."

---

### Iteration 3: Saving Feedback

**Feedback received:** When users changed their builder's name or appearance in the profile, they weren't sure if the changes were being saved to the server.

**Change made:** We added a "Saving..." indicator with a spinning icon that appears whenever a change is made, providing immediate visual feedback that the data is being synced.

```
[ SCREENSHOT PLACEHOLDER — Profile AFTER (Saving indicator visible) ]
```

**Summary of change:** "Users were unsure if their profile edits were saved, so we added a real-time saving indicator."

---

## Section 3: Entity Relationship Diagram

The diagram below shows all database tables used by BUILDHAUS, their fields, and the relationships between them.

```
[ ERD DIAGRAM PLACEHOLDER — Insert exported ERD image here ]
```

### Text Representation of Relationships

- **users to focus_sessions:** One-to-Many (Each user has many sessions)
- **users to achievements:** One-to-Many (Each user earns multiple badges)
- **users to user_items:** One-to-Many (Junction for purchased shop items)
- **users to flashcard_sets:** One-to-Many (Each user creates many study sets)
- **flashcard_sets to flashcards:** One-to-Many (Each set contains many cards)
- **flashcard_sets to quiz_attempts:** One-to-Many (Each set can be quizzed multiple times)

---

## Section 4: Entity Descriptions

---

### Table: users

| Field Name | Description | Data Type | Constraint |
|---|---|---|---|
| id | Unique user ID | INTEGER | Primary Key |
| name | Display name | TEXT | NOT NULL |
| email | SPU or personal email | TEXT | UNIQUE, NOT NULL |
| password | Hashed password | TEXT | NOT NULL |
| faculty | Selected faculty | TEXT | NOT NULL |
| student_no | Optional student ID | TEXT | UNIQUE |
| gender | Character identity | TEXT | male/female/other |
| coins | Virtual currency | INTEGER | DEFAULT 100 |

---

### Table: focus_sessions

| Field Name | Description | Data Type | Constraint |
|---|---|---|---|
| id | Session ID | INTEGER | Primary Key |
| user_id | Owner of session | INTEGER | Foreign Key |
| duration | Target time in seconds | INTEGER | NOT NULL |
| elapsed | Actual time spent | INTEGER | NOT NULL |
| completed | Success status | INTEGER | 1 = Yes, 0 = No |

---

## Section 5: Relationship Justification

### One-to-Many Relationships
The majority of relationships in BUILDHAUS are one-to-many. For example, a single student (User) will naturally generate many study sessions and earn many achievements over their time at SPU. Storing these in separate tables linked by a user ID is the most efficient way to manage this growing data without duplicating student information.

### Many-to-Many Relationships
The relationship between Users and Shop Items is many-to-many because many students can buy the same hat, and one student can own many different hats. We use the user_items table as a junction to track these ownership records cleanly.

---

## Section 6: Technology Choice

### Database: SQLite
We selected SQLite for this project because it is a serverless and self-contained database engine. This makes it perfect for a student assignment because the entire database is stored in a single file that can be easily shared and deployed. SQLite supports all the relational features we need, including foreign keys and complex joins, without the overhead of managing a separate database server.

### Backend: Node.js and Express
Node.js was chosen for the backend because it allows us to use JavaScript for both the frontend and the server. Express provides a simple way to build the API routes that handle authentication, session tracking, and AI flashcard generation.

### Frontend: React and Three.js
React allows us to build a responsive and modular user interface. We used Three.js to create the 3D game world where the houses are built, providing a visually engaging experience that motivates students to stay focused on their studies.

---

*BUILDHAUS / CampusBuilder — Empowering academic focus through gamified productivity.*
*Sol Plaatje University | Faculty of Natural and Applied Sciences | 2026*
