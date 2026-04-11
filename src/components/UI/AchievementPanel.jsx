const { useState, useEffect, useRef, useCallback, useMemo } = React;
const AchievementPanel = ({ rewards }) => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    
    const categories = [
        { id: 'all', name: 'All', icon: 'grid' },
        { id: 'focus', name: 'Focus', icon: 'target' },
        { id: 'building', name: 'Building', icon: 'home' },
        { id: 'streak', name: 'Streaks', icon: 'zap' },
        { id: 'milestone', name: 'Milestones', icon: 'flag' }
    ];
    
    const filteredAchievements = selectedCategory === 'all' 
        ? rewards.allAchievements
        : rewards.allAchievements.filter(achievement => achievement.category === selectedCategory);
    
    const getProgressPercentage = (achievement) => {
        if (achievement.unlocked) return 100;
        if (!achievement.progress) return 0;
        return Math.min((achievement.progress.current / achievement.progress.target) * 100, 100);
    };
    
    const getRarityClass = (rarity) => {
        const rarityClasses = {
            common: 'rarity-common',
            uncommon: 'rarity-uncommon',
            rare: 'rarity-rare',
            epic: 'rarity-epic',
            legendary: 'rarity-legendary'
        };
        return rarityClasses[rarity] || rarityClasses.common;
    };
    
    return (
        <div className="achievement-panel">
            <h2>Achievements</h2>
            
            {/* Achievement Stats */}
            <div className="achievement-stats">
                <div className="stat-card">
                    <h3>{rewards.allAchievements.filter(a => a.unlocked).length}</h3>
                    <p>Unlocked</p>
                </div>
                <div className="stat-card">
                    <h3>{rewards.allAchievements.length}</h3>
                    <p>Total</p>
                </div>
                <div className="stat-card">
                    <h3>{Math.floor((rewards.allAchievements.filter(a => a.unlocked).length / rewards.allAchievements.length) * 100)}%</h3>
                    <p>Complete</p>
                </div>
            </div>
            
            {/* Category Filter */}
            <div className="achievement-categories">
                {categories.map(category => (
                    <button
                        key={category.id}
                        className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(category.id)}
                    >
                        <i data-feather={category.icon}></i>
                        {category.name}
                    </button>
                ))}
            </div>
            
            {/* Achievement List */}
            <div className="achievement-list">
                {filteredAchievements.map((achievement, index) => (
                    <div 
                        key={index}
                        className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'} ${getRarityClass(achievement.rarity)}`}
                    >
                        <div className="achievement-icon">
                            <i data-feather={achievement.icon}></i>
                            {achievement.unlocked && (
                                <div className="unlock-checkmark">
                                    <i data-feather="check"></i>
                                </div>
                            )}
                        </div>
                        
                        <div className="achievement-content">
                            <div className="achievement-header">
                                <h3>{achievement.unlocked ? achievement.name : '???'}</h3>
                                <div className="achievement-rarity">
                                    {achievement.rarity}
                                </div>
                            </div>
                            
                            <p className="achievement-description">
                                {achievement.unlocked ? achievement.description : 'Complete more tasks to reveal this achievement!'}
                            </p>
                            
                            {achievement.unlocked && achievement.unlockedAt && (
                                <div className="unlock-date">
                                    <i data-feather="calendar"></i>
                                    <span>Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}</span>
                                </div>
                            )}
                            
                            {!achievement.unlocked && achievement.progress && (
                                <div className="progress-section">
                                    <div className="progress-text">
                                        Progress: {achievement.progress.current}/{achievement.progress.target}
                                    </div>
                                    <div className="progress-bar">
                                        <div 
                                            className="progress-fill"
                                            style={{ width: `${getProgressPercentage(achievement)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="achievement-reward">
                                <i data-feather="gift"></i>
                                <span>+{achievement.coinReward} coins</span>
                                {achievement.specialReward && (
                                    <span className="special-reward">+ {achievement.specialReward}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {filteredAchievements.length === 0 && (
                <div className="no-achievements">
                    <i data-feather="search"></i>
                    <p>No achievements found in this category.</p>
                </div>
            )}
            
            {/* Achievement Hints */}
            <div className="achievement-hints">
                <h3>Achievement Hints</h3>
                <div className="hint-list">
                    <div className="hint-item">
                        <i data-feather="lightbulb"></i>
                        <span>Complete your first focus session to unlock "First Steps"</span>
                    </div>
                    <div className="hint-item">
                        <i data-feather="lightbulb"></i>
                        <span>Build 5 houses in a row without interruption for "Steady Builder"</span>
                    </div>
                    <div className="hint-item">
                        <i data-feather="lightbulb"></i>
                        <span>Maintain a 7-day focus streak for "Week Warrior"</span>
                    </div>
                    <div className="hint-item">
                        <i data-feather="lightbulb"></i>
                        <span>Focus for 10 hours total to unlock "Marathon Builder"</span>
                    </div>
                </div>
            </div>
            
            {/* Upcoming Achievements */}
            <div className="upcoming-achievements">
                <h3>Close to Unlocking</h3>
                <div className="upcoming-list">
                    {rewards.allAchievements
                        .filter(a => !a.unlocked && a.progress && getProgressPercentage(a) > 50)
                        .sort((a, b) => getProgressPercentage(b) - getProgressPercentage(a))
                        .slice(0, 3)
                        .map((achievement, index) => (
                            <div key={index} className="upcoming-item">
                                <div className="upcoming-icon">
                                    <i data-feather={achievement.icon}></i>
                                </div>
                                <div className="upcoming-info">
                                    <h4>Secret Achievement</h4>
                                    <div className="upcoming-progress">
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: `${getProgressPercentage(achievement)}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.floor(getProgressPercentage(achievement))}% complete</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                    
                    {rewards.allAchievements.filter(a => !a.unlocked && a.progress && getProgressPercentage(a) > 50).length === 0 && (
                        <p className="no-upcoming">Keep focusing to get closer to new achievements!</p>
                    )}
                </div>
            </div>
        </div>
    );
};

window.AchievementPanel = AchievementPanel;
