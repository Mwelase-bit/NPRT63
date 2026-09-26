const { useState, useEffect, useRef, useCallback, useMemo } = React;
const useRewards = (gameState, timer) => {
    const [rewards, setRewards] = useState({
        coins: 100, // Starting coins
        streak: 0,
        housesBuilt: 0,
        totalFocusTime: 0,
        longestSession: 0,
        averageSession: 0,
        successRate: 100,
        completedSessions: 0,
        failedSessions: 0,
        lastFocusDate: null,
        recentAchievements: [],
        allAchievements: [],
        dailyStats: {
            sessionsToday: 0,
            timeToday: 0,
            coinsToday: 0,
            dailyLoginClaimed: false,
            dailyProgressClaimed: false
        },
        weeklyStats: {
            sessionsThisWeek: 0,
            timeThisWeek: 0,
            weeklyChallengeClaimed: false
        }
    });

    // Load rewards from storage on mount
    useEffect(() => {
        const savedRewards = Storage.getRewards();
        if (savedRewards) {
            setRewards(prev => ({
                ...prev,
                ...savedRewards,
                allAchievements: ACHIEVEMENTS.map(achievement => {
                    const saved = savedRewards.allAchievements?.find(a => a.id === achievement.id);
                    return saved || { ...achievement, unlocked: false, progress: achievement.progress };
                })
            }));
        } else {
            // Initialize achievements
            setRewards(prev => ({
                ...prev,
                allAchievements: ACHIEVEMENTS.map(achievement => ({
                    ...achievement,
                    unlocked: false,
                    progress: achievement.progress
                }))
            }));
        }
    }, []);

    // Save rewards to storage whenever they change
    useEffect(() => {
        Storage.saveRewards(rewards);
    }, [rewards]);

    // Update daily stats at midnight
    useEffect(() => {
        const checkDaily = () => {
            const today = new Date().toDateString();
            const lastDate = rewards.lastFocusDate ? new Date(rewards.lastFocusDate).toDateString() : null;

            if (today !== lastDate) {
                setRewards(prev => ({
                    ...prev,
                    dailyStats: {
                        sessionsToday: 0,
                        timeToday: 0,
                        coinsToday: 0,
                        dailyLoginClaimed: false,
                        dailyProgressClaimed: false
                    }
                }));
            }
        };

        const interval = setInterval(checkDaily, 60000); // Check every minute
        checkDaily(); // Check immediately

        return () => clearInterval(interval);
    }, [rewards.lastFocusDate]);

    // Sync all stats from backend to resolve divergence
    const syncWithBackend = useCallback(async () => {
        if (!gameState?.token) return;
        try {
            const stats = await window.api.sessions.getStats();

            setRewards(prev => ({
                ...prev,
                coins: stats.coins,
                streak: stats.streak,
                housesBuilt: stats.housesBuilt,
                totalFocusTime: stats.totalFocusTime,
                longestSession: stats.longestSession,
                successRate: stats.successRate,
                completedSessions: stats.completedSessions,
                failedSessions: stats.failedSessions,
                // keep local-only fields intact
                dailyStats: {
                    ...prev.dailyStats,
                    sessionsToday: stats.dailyStats.sessionsToday,
                    timeToday: stats.dailyStats.timeToday
                },
                weeklyStats: {
                    ...prev.weeklyStats,
                    sessionsThisWeek: stats.weeklyStats.sessionsThisWeek,
                    timeThisWeek: stats.weeklyStats.timeThisWeek
                }
            }));

            // Sync unlocked achievements
            const achs = await window.api.achievements.getAll();
            if (achs && achs.achievements) {
                setRewards(prev => {
                    const updated = prev.allAchievements.map(a => {
                        const backendRecord = achs.achievements.find(ba => ba.achievement_id === a.id);
                        if (backendRecord) {
                            return { ...a, unlocked: true, unlockedAt: backendRecord.unlocked_at };
                        }
                        return a;
                    });
                    return { ...prev, allAchievements: updated };
                });
            }
        } catch (err) {
            console.error('Failed to sync backend stats', err);
        }
    }, [gameState?.token]);

    // Initial sync
    useEffect(() => {
        syncWithBackend();
    }, [syncWithBackend]);

    const awardCoins = (sessionDuration) => {
        const baseCoins = Math.floor(sessionDuration / 60); // 1 coin per minute
        const streakBonus = Math.min(rewards.streak * 5, 50); // Max 50 bonus
        const totalCoins = baseCoins + streakBonus;

        setRewards(prev => ({
            ...prev,
            coins: prev.coins + totalCoins,
            dailyStats: {
                ...prev.dailyStats,
                coinsToday: prev.dailyStats.coinsToday + totalCoins
            }
        }));

        return totalCoins;
    };

    const spendCoins = (amount) => {
        if (rewards.coins >= amount) {
            setRewards(prev => ({
                ...prev,
                coins: prev.coins - amount
            }));
            return true;
        }
        return false;
    };

    const updateStreak = () => {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const lastFocusDate = rewards.lastFocusDate ? new Date(rewards.lastFocusDate).toDateString() : null;

        let newStreak = rewards.streak;

        if (lastFocusDate === yesterday) {
            // Continue streak
            newStreak += 1;
        } else if (lastFocusDate === today) {
            // Already focused today, no change
            return;
        } else if (lastFocusDate !== today) {
            // Streak broken, reset to 1
            newStreak = 1;
        }

        // Award streak milestone bonuses
        const milestones = [3, 7, 14, 20, 50];
        const milestone = milestones.find(m => m === newStreak);
        if (milestone) {
            const bonus = milestone * 10;
            setRewards(prev => ({
                ...prev,
                coins: prev.coins + bonus
            }));
        }

        setRewards(prev => ({
            ...prev,
            streak: newStreak,
            lastFocusDate: Date.now()
        }));
    };

    const recordSession = (duration, completed) => {
        setRewards(prev => {
            const newTotalTime = prev.totalFocusTime + (completed ? duration : 0);
            const newCompleted = prev.completedSessions + (completed ? 1 : 0);
            const newFailed = prev.failedSessions + (completed ? 0 : 1);
            const newTotal = newCompleted + newFailed;

            return {
                ...prev,
                totalFocusTime: newTotalTime,
                longestSession: Math.max(prev.longestSession, completed ? duration : 0),
                averageSession: newCompleted > 0 ? Math.floor(newTotalTime / newCompleted) : 0,
                successRate: Math.floor((newCompleted / Math.max(newTotal, 1)) * 100),
                completedSessions: newCompleted,
                failedSessions: newFailed,
                // housesBuilt is NOT incremented here — the backend does it via
                // sessions.js (houses_built + 1) and syncWithBackend() pulls the
                // authoritative value back. Incrementing here too caused a double-count.
                dailyStats: {
                    ...prev.dailyStats,
                    sessionsToday: prev.dailyStats.sessionsToday + 1,
                    timeToday: prev.dailyStats.timeToday + (completed ? duration : 0)
                },
                weeklyStats: {
                    ...prev.weeklyStats,
                    sessionsThisWeek: prev.weeklyStats.sessionsThisWeek + 1,
                    timeThisWeek: prev.weeklyStats.timeThisWeek + (completed ? duration : 0)
                }
            };
        });

        // Check for new achievements
        checkAchievements();
    };

    const checkAchievements = () => {
        setRewards(prev => {
            const updatedAchievements = prev.allAchievements.map(achievement => {
                if (achievement.unlocked) return achievement;

                const progress = calculateAchievementProgress(achievement, prev);
                const shouldUnlock = progress && progress.current >= progress.target;

                if (shouldUnlock) {
                    const unlockedAchievement = {
                        ...achievement,
                        unlocked: true,
                        unlockedAt: Date.now(),
                        progress: progress
                    };

                    // Add to recent achievements
                    prev.recentAchievements.unshift(unlockedAchievement);
                    if (prev.recentAchievements.length > 10) {
                        prev.recentAchievements.pop();
                    }

                    // Award coins
                    prev.coins += achievement.coinReward;

                    return unlockedAchievement;
                }

                return {
                    ...achievement,
                    progress: progress
                };
            });

            return {
                ...prev,
                allAchievements: updatedAchievements
            };
        });
    };

    const calculateAchievementProgress = (achievement, rewardData) => {
        if (!achievement.progress) return null;

        let current = 0;

        switch (achievement.progress.type) {
            case 'sessions':
                current = rewardData.completedSessions;
                break;
            case 'houses':
                current = rewardData.housesBuilt;
                break;
            case 'streak':
                current = rewardData.streak;
                break;
            case 'time':
                current = rewardData.totalFocusTime;
                break;
            case 'coins':
                current = rewardData.coins;
                break;
            default:
                current = 0;
        }

        return {
            current: current,
            target: achievement.progress.target
        };
    };

    // Record session when timer completes or is interrupted
    useEffect(() => {
        if (timer.isCompleted) {
            recordSession(timer.duration, true);
            updateStreak();
        }
    }, [timer.isCompleted]);

    useEffect(() => {
        if (!timer.isActive && timer.duration > 0 && timer.timeLeft > 0 && timer.timeLeft < timer.duration) {
            // Session was interrupted
            recordSession(timer.duration - timer.timeLeft, false);
        }
    }, [timer.isActive]);

    const claimDailyLogin = () => {
        if (!rewards.dailyStats.dailyLoginClaimed) {
            setRewards(prev => ({
                ...prev,
                coins: prev.coins + 50,
                dailyStats: {
                    ...prev.dailyStats,
                    dailyLoginClaimed: true,
                    coinsToday: prev.dailyStats.coinsToday + 50
                }
            }));
            return true;
        }
        return false;
    };

    const claimDailyProgress = () => {
        if (!rewards.dailyStats.dailyProgressClaimed && (rewards.dailyStats.sessionsToday >= 5 || rewards.dailyStats.timeToday >= 7200)) {
            setRewards(prev => ({
                ...prev,
                coins: prev.coins + 200,
                dailyStats: {
                    ...prev.dailyStats,
                    dailyProgressClaimed: true,
                    coinsToday: prev.dailyStats.coinsToday + 200
                }
            }));
            return true;
        }
        return false;
    };

    const claimWeeklyChallenge = () => {
        if (!rewards.weeklyStats.weeklyChallengeClaimed && rewards.weeklyStats.sessionsThisWeek >= 20) {
            setRewards(prev => ({
                ...prev,
                coins: prev.coins + 500,
                weeklyStats: {
                    ...prev.weeklyStats,
                    weeklyChallengeClaimed: true
                }
            }));
            return true;
        }
        return false;
    };

    return {
        ...rewards,
        awardCoins,
        spendCoins,
        updateStreak,
        recordSession,
        checkAchievements,
        claimDailyLogin,
        claimDailyProgress,
        claimWeeklyChallenge,
        syncWithBackend
    };
};

window.useRewards = useRewards;
