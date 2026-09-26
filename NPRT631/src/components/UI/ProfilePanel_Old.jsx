const { useState } = React;
const ProfilePanel = ({ gameState, rewards }) => {
    const [showCustomization, setShowCustomization] = useState(true);

    return (
        <div className="profile-panel" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Builder Profile</h2>
            </div>

            <div className="customization-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>Customize Your Builder</h4>
                    {/* No Saving Indicator here */}
                </div>

                <div className="customization-options">
                    <div className="option-group">
                        <label>Gender:</label>
                        <div className="radio-group">
                            <label>
                                <input type="radio" name="gender" value="male" checked readOnly />
                                Male
                            </label>
                            <label>
                                <input type="radio" name="gender" value="female" readOnly />
                                Female
                            </label>
                            {/* Missing 'Other' option */}
                        </div>
                    </div>
                </div>
            </div>

            <div className="focus-statistics">
                <h3>Focus Statistics</h3>
                {/* No Generate Report button here */}
                <div className="stats-grid">
                    <div className="stat-item">
                        <label>Total Focus Time</label>
                        <span>12h 45m</span>
                    </div>
                    <div className="stat-item">
                        <label>Success Rate</label>
                        <span>85%</span>
                    </div>
                </div>
            </div>
            
            {/* No Admin Panel here */}
        </div>
    );
};

window.ProfilePanel = ProfilePanel;
