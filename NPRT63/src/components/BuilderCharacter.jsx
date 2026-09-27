const BuilderCharacter = ({ gameState, timer, interruptionDetected }) => {
    const builderRef = useRef();
    const [animationState, setAnimationState] = useState('idle');
    
    // Animation loop
    useFrame((state, delta) => {
        if (builderRef.current) {
            // Determine animation based on game state
            if (interruptionDetected || gameState.isCollapsing) {
                setAnimationState('frustrated');
            } else if (timer.isActive && !timer.isPaused) {
                setAnimationState('building');
            } else if (timer.isCompleted) {
                setAnimationState('celebrating');
            } else {
                setAnimationState('idle');
            }
            
            // Simple animation implementations
            switch (animationState) {
                case 'building':
                    // Hammering animation
                    builderRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 8) * 0.1;
                    break;
                case 'frustrated':
                    // Shaking head animation
                    builderRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 10) * 0.2;
                    break;
                case 'celebrating':
                    // Arms up celebration
                    builderRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
                    break;
                default:
                    // Idle - slight breathing motion
                    builderRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
                    builderRef.current.rotation.z = 0;
                    builderRef.current.rotation.y = 0;
            }
        }
    });
    
    const customization = gameState.builderCustomization;
    
    return (
        <group ref={builderRef} position={[-1, 0.5, 1]}>
            {/* Builder Body */}
            <Box args={[0.6, 1, 0.3]} position={[0, 0, 0]}>
                <meshLambertMaterial color={customization.overallColor} />
            </Box>
            
            {/* Builder Head */}
            <Sphere args={[0.25]} position={[0, 0.7, 0]}>
                <meshLambertMaterial color={customization.skinColor} />
            </Sphere>
            
            {/* Hard Hat */}
            <Box args={[0.4, 0.15, 0.4]} position={[0, 0.9, 0]}>
                <meshLambertMaterial color={customization.hatColor} />
            </Box>
            
            {/* Arms */}
            <Box args={[0.15, 0.6, 0.15]} position={[-0.4, 0.1, 0]}>
                <meshLambertMaterial color={customization.skinColor} />
            </Box>
            <Box args={[0.15, 0.6, 0.15]} position={[0.4, 0.1, 0]}>
                <meshLambertMaterial color={customization.skinColor} />
            </Box>
            
            {/* Legs */}
            <Box args={[0.15, 0.6, 0.15]} position={[-0.15, -0.8, 0]}>
                <meshLambertMaterial color={customization.overallColor} />
            </Box>
            <Box args={[0.15, 0.6, 0.15]} position={[0.15, -0.8, 0]}>
                <meshLambertMaterial color={customization.overallColor} />
            </Box>
            
            {/* Tool Belt */}
            <Box args={[0.7, 0.1, 0.35]} position={[0, -0.3, 0]}>
                <meshLambertMaterial color="#8B4513" />
            </Box>
            
            {/* Hair (if applicable) */}
            {customization.gender === 'female' && customization.hairStyle === 'ponytail' && (
                <Sphere args={[0.1, 0.3, 0.1]} position={[0, 0.6, -0.3]}>
                    <meshLambertMaterial color={customization.hairColor} />
                </Sphere>
            )}
            
            {/* Hammer Tool */}
            {animationState === 'building' && (
                <group position={[0.5, 0.3, 0]} rotation={[0, 0, Math.PI / 4]}>
                    <Box args={[0.05, 0.4, 0.05]}>
                        <meshLambertMaterial color="#8B4513" />
                    </Box>
                    <Box args={[0.15, 0.1, 0.1]} position={[0, 0.25, 0]}>
                        <meshLambertMaterial color="#C0C0C0" />
                    </Box>
                </group>
            )}
        </group>
    );
};

window.BuilderCharacter = BuilderCharacter;
