const { useState } = React;
const TimerPanel = ({ timer, onStartSession, gameState }) => {
    const [selectedMinutes, setSelectedMinutes] = useState(25);
    
    // Stub out missing props for rendering purely as a mockup
    const safeTimer = timer || { isActive: false, duration: 0, timeLeft: 0, isCompleted: false };
    const safeGameState = gameState || { currentHouse: 'Basic House', buildStage: 0 };
    
    return (
        <div className="timer-panel" style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', background: '#222' }}>
            <h2>Focus Session</h2>
            
            <div className="timer-setup">
                <div className="duration-selector">
                    <h4>Set Focus Duration:</h4>
                    <div className="minutes-input-container">
                        <label>Minutes:</label>
                        <input
                            type="range"
                            min="5" max="120"
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
                
                <button
                    className="start-btn btn btn-primary btn-lg"
                    style={{ width: '100%', marginTop: '20px', padding: '15px' }}
                >
                    Start Focus Session
                </button>
                <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#888', textAlign: 'center' }}>
                    (No toast notification or visual feedback shown when clicked)
                </div>
            </div>
        </div>
    );
};

window.TimerPanel = TimerPanel;
