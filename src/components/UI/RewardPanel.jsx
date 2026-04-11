const RewardPanel = ({ rewards }) => {
    return (
        <div className="reward-panel">
            <h2>Your Rewards</h2>
            
            {/* Daily Login Bonus */}
            {!rewards.dailyStats.dailyLoginClaimed && (
                <div className="daily-login-banner" style={{
                    backgroundColor: 'rgba(255, 215, 0, 0.15)',
                    border: '1px solid #FFD700',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div className="login-bonus-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i data-feather="gift" style={{ color: '#FFD700' }}></i>
                        <div>
                            <h4 style={{ margin: 0, color: '#FFD700' }}>Daily Check-In Bonus</h4>
                            <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>Thanks for focusing today! Here's 50 coins.</p>
                        </div>
                    </div>
                    <button 
                        className="btn btn-warning"
                        onClick={() => rewards.claimDailyLogin()}
                    >
                        Claim 50 Coins
                    </button>
                </div>
            )}
            
            {/* Current Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">
                        <i data-feather="dollar-sign"></i>
                    </div>
                    <div className="stat-info">
                        <h3>{rewards.coins}</h3>
                        <p>Total Coins</p>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon">
                        <i data-feather="zap"></i>
                    </div>
                    <div className="stat-info">
                        <h3>{rewards.streak}</h3>
                        <p>Day Streak</p>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon">
                        <i data-feather="home"></i>
                    </div>
                    <div className="stat-info">
                        <h3>{rewards.housesBuilt}</h3>
                        <p>Houses Built</p>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon">
                        <i data-feather="clock"></i>
                    </div>
                    <div className="stat-info">
                        <h3>{Math.floor(rewards.totalFocusTime / 3600)}h</h3>
                        <p>Total Focus</p>
                    </div>
                </div>
            </div>
            
            {/* Recent Achievements */}
            <div className="recent-achievements">
                <h3>Recent Achievements</h3>
                <div className="achievement-list">
                    {rewards.recentAchievements.length > 0 ? (
                        rewards.recentAchievements.slice(0, 5).map((achievement, index) => (
                            <div key={index} className="achievement-item recent">
                                <div className="achievement-icon">
                                    <i data-feather={achievement.icon}></i>
                                </div>
                                <div className="achievement-info">
                                    <h4>{achievement.name}</h4>
                                    <p>{achievement.description}</p>
                                    <span className="reward-amount">+{achievement.coinReward} coins</span>
                                </div>
                                <div className="achievement-timestamp">
                                    <small>{new Date(achievement.unlockedAt).toLocaleDateString()}</small>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="no-achievements">Complete focus sessions to earn achievements!</p>
                    )}
                </div>
            </div>
            
            {/* Streak Bonuses */}
            <div className="streak-bonuses">
                <h3>Streak Bonuses</h3>
                <div className="bonus-track">
                    {[
                        { days: 3, reward: "30 coins" },
                        { days: 7, reward: "70 coins" },
                        { days: 14, reward: "140 coins" },
                        { days: 20, reward: "1GB Data" },
                        { days: 50, reward: "5GB Data" }
                    ].map((milestone) => (
                        <div 
                            key={milestone.days}
                            className={`bonus-milestone ${rewards.streak >= milestone.days ? 'achieved' : 'pending'}`}
                        >
                            <div className="milestone-number">{milestone.days}</div>
                            <div className="milestone-reward">
                                <i data-feather="gift"></i>
                                {milestone.reward}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="next-milestone">
                    {rewards.streak < 50 && (
                        <>
                            Next milestone in {
                                [3, 7, 14, 20, 50].find(m => m > rewards.streak) - rewards.streak
                            } days!
                        </>
                    )}
                </p>
            </div>
            
            {/* Daily Summary */}
            <div className="daily-summary">
                <h3>Today's Progress</h3>
                <div className="progress-bars">
                    <div className="progress-item">
                        <label>Focus Sessions: {rewards.dailyStats.sessionsToday}/5</label>
                        <div className="progress-bar">
                            <div 
                                className="progress-fill"
                                style={{ width: `${(rewards.dailyStats.sessionsToday / 5) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    
                    <div className="progress-item">
                        <label>Focus Time: {Math.floor(rewards.dailyStats.timeToday / 60)}min / 120min</label>
                        <div className="progress-bar">
                            <div 
                                className="progress-fill"
                                style={{ width: `${Math.min((rewards.dailyStats.timeToday / 7200) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
                
                {/* Daily Progress Claim Button */}
                <div style={{ marginTop: '15px', textAlign: 'center' }}>
                    {rewards.dailyStats.dailyProgressClaimed ? (
                        <button className="btn btn-secondary" disabled>
                            <i data-feather="check"></i> Claimed (200 Coins)
                        </button>
                    ) : (rewards.dailyStats.sessionsToday >= 5 || rewards.dailyStats.timeToday >= 7200) ? (
                        <button className="btn btn-success" onClick={() => rewards.claimDailyProgress()}>
                            <i data-feather="gift"></i> Claim Daily Reward (200 Coins)
                        </button>
                    ) : (
                        <button className="btn btn-outline-secondary" disabled>
                            Complete 5 Sessions or 120min to Claim
                        </button>
                    )}
                </div>
            </div>
            
            {/* Weekly Challenge */}
            <div className="weekly-challenge">
                <h3>Weekly Challenge</h3>
                <div className="challenge-card">
                    <div className="challenge-icon">
                        <i data-feather="target"></i>
                    </div>
                    <div className="challenge-info">
                        <h4>Master Builder</h4>
                        <p>Complete 20 focus sessions this week</p>
                        <div className="challenge-progress">
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill"
                                    style={{ width: `${Math.min((rewards.weeklyStats.sessionsThisWeek / 20) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <span>{rewards.weeklyStats.sessionsThisWeek}/20</span>
                        </div>
                        <div className="challenge-reward" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                            <div>
                                <i data-feather="award"></i>
                                Reward: 500 coins + Special Badge
                            </div>
                            
                            {rewards.weeklyStats.weeklyChallengeClaimed ? (
                                <button className="btn btn-sm btn-secondary" disabled>
                                    Claimed
                                </button>
                            ) : rewards.weeklyStats.sessionsThisWeek >= 20 ? (
                                <button className="btn btn-sm btn-success" onClick={() => rewards.claimWeeklyChallenge()}>
                                    Claim 500 Coins
                                </button>
                            ) : (
                                <button className="btn btn-sm btn-outline-secondary" disabled>
                                    In Progress
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

window.RewardPanel = RewardPanel;
