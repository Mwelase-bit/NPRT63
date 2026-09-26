const { useState, useEffect, useRef, useCallback, useMemo } = React;
const TimerPanel = ({ timer, onStartSession, gameState }) => {
    const [selectedMinutes, setSelectedMinutes] = useState(25); // Default 25 minutes
    
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const getProgressPercentage = () => {
        if (!timer.duration) return 0;
        return ((timer.duration - timer.timeLeft) / timer.duration) * 100;
    };
    
    return (
        <div className="timer-panel">
            <h2>Focus Session</h2>
            
            {!timer.isActive ? (
                <div className="timer-setup">
                    <div className="duration-selector">
                        <h4>Set Focus Duration:</h4>
                        <div className="minutes-input-container">
                            <label htmlFor="minutes-input">Minutes:</label>
                            <input
                                id="minutes-input"
                                type="range"
                                min="5"
                                max="120"
                                value={selectedMinutes}
                                onChange={(e) => setSelectedMinutes(parseInt(e.target.value))}
                                className="minutes-slider"
                            />
                            <div className="minutes-display">
                                <span className="minutes-value">{selectedMinutes}</span>
                                <span className="minutes-label">minutes</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="house-preview">
                        <h4>Current Project:</h4>
                        <div className="build-stages">
                            <div className="stage">
                                <i data-feather="home"></i>
                                Ready to build: {gameState.currentHouse}
                            </div>
                        </div>
                    </div>
                    
                    <button
                        className="start-btn btn btn-primary btn-lg"
                        onClick={() => onStartSession(selectedMinutes * 60)}
                    >
                        <i data-feather="play"></i>
                        Start Focus Session
                    </button>
                </div>
            ) : (
                <div className="timer-active">
                    <div className="timer-display">
                        <div className="time-remaining">
                            {formatTime(timer.timeLeft)}
                        </div>
                        
                        <div className="progress-bar">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${getProgressPercentage()}%` }}
                            ></div>
                        </div>
                        
                        <div className="session-info">
                            <span>Building Stage: {gameState.buildStage}/4</span>
                            <span>Total Time: {formatTime(timer.duration)}</span>
                        </div>
                    </div>
                    
                    <div className="timer-controls">
                        <button
                            className="btn btn-danger btn-lg"
                            onClick={() => {
                                timer.stop();
                                gameState.resetBuilding();
                            }}
                        >
                            <i data-feather="square"></i>
                            Stop Session
                        </button>
                    </div>
                    
                    <div className="focus-tips">
                        <p><strong>Stay Focused!</strong> Any interruption will cause the house to crumble!</p>
                        <p>Current House: {gameState.currentHouse}</p>
                    </div>
                </div>
            )}
            
            {timer.isCompleted && (
                <div className="completion-message">
                    <div className="success-animation">
                        <i data-feather="check-circle"></i>
                        <h3>Great Job!</h3>
                        <p>You successfully completed your focus session!</p>
                        <p>Your {gameState.currentHouse} has been built!</p>
                    </div>
                </div>
            )}
        </div>
    );
};

window.TimerPanel = TimerPanel;
