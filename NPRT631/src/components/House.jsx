const House = ({ buildStage, houseType, isCollapsing, interruptionDetected, position = [0, 0, 0], isCompleted = false }) => {
    const houseRef = useRef();
    const [collapseAnimation, setCollapseAnimation] = useState(0);
    
    // Collapse animation
    useFrame((state, delta) => {
        if (houseRef.current) {
            if (isCollapsing || interruptionDetected) {
                setCollapseAnimation(prev => Math.min(prev + delta * 2, 1));
                
                // Shake and fall animation
                houseRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.1 * collapseAnimation;
                houseRef.current.position.y = position[1] - collapseAnimation * 2;
            } else {
                setCollapseAnimation(0);
                houseRef.current.rotation.z = 0;
                houseRef.current.position.y = position[1];
            }
        }
    });
    
    const houseData = HOUSE_TYPES[houseType] || HOUSE_TYPES.cottage;
    const stageToShow = isCollapsing ? 0 : buildStage;
    
    return (
        <group ref={houseRef} position={position}>
            {/* Foundation - Stage 1 */}
            {stageToShow >= 1 && (
                <Box args={[houseData.foundation.width, 0.2, houseData.foundation.depth]} position={[0, 0.1, 0]}>
                    <meshLambertMaterial color="#808080" />
                </Box>
            )}
            
            {/* Walls - Stage 2 */}
            {stageToShow >= 2 && (
                <group>
                    {/* Front Wall */}
                    <Box args={[houseData.walls.width, houseData.walls.height, 0.2]} position={[0, houseData.walls.height / 2 + 0.2, houseData.walls.depth / 2]}>
                        <meshLambertMaterial color={houseData.colors.walls} />
                    </Box>
                    {/* Back Wall */}
                    <Box args={[houseData.walls.width, houseData.walls.height, 0.2]} position={[0, houseData.walls.height / 2 + 0.2, -houseData.walls.depth / 2]}>
                        <meshLambertMaterial color={houseData.colors.walls} />
                    </Box>
                    {/* Left Wall */}
                    <Box args={[0.2, houseData.walls.height, houseData.walls.depth]} position={[-houseData.walls.width / 2, houseData.walls.height / 2 + 0.2, 0]}>
                        <meshLambertMaterial color={houseData.colors.walls} />
                    </Box>
                    {/* Right Wall */}
                    <Box args={[0.2, houseData.walls.height, houseData.walls.depth]} position={[houseData.walls.width / 2, houseData.walls.height / 2 + 0.2, 0]}>
                        <meshLambertMaterial color={houseData.colors.walls} />
                    </Box>
                </group>
            )}
            
            {/* Door - Stage 2 */}
            {stageToShow >= 2 && (
                <Box args={[0.8, 1.5, 0.1]} position={[0, 0.95, houseData.walls.depth / 2 + 0.05]}>
                    <meshLambertMaterial color={houseData.colors.door} />
                </Box>
            )}
            
            {/* Windows - Stage 2 */}
            {stageToShow >= 2 && (
                <group>
                    <Box args={[0.6, 0.6, 0.1]} position={[-1, 1.2, houseData.walls.depth / 2 + 0.05]}>
                        <meshLambertMaterial color="#87CEEB" />
                    </Box>
                    <Box args={[0.6, 0.6, 0.1]} position={[1, 1.2, houseData.walls.depth / 2 + 0.05]}>
                        <meshLambertMaterial color="#87CEEB" />
                    </Box>
                </group>
            )}
            
            {/* Roof - Stage 3 */}
            {stageToShow >= 3 && (
                <group>
                    {/* Roof Base */}
                    <Box 
                        args={[houseData.roof.width, 0.3, houseData.roof.depth]} 
                        position={[0, houseData.walls.height + 0.5, 0]}
                        rotation={[0, 0, houseData.roof.angle]}
                    >
                        <meshLambertMaterial color={houseData.colors.roof} />
                    </Box>
                    
                    {/* Roof Peak */}
                    <Box 
                        args={[houseData.roof.width + 0.2, 0.2, houseData.roof.depth + 0.2]} 
                        position={[0, houseData.walls.height + 0.8, 0]}
                    >
                        <meshLambertMaterial color={houseData.colors.roof} />
                    </Box>
                </group>
            )}
            
            {/* Finishing Touches - Stage 4 */}
            {stageToShow >= 4 && (
                <group>
                    {/* Chimney */}
                    <Box args={[0.4, 1.2, 0.4]} position={[1.5, houseData.walls.height + 1.1, -0.5]}>
                        <meshLambertMaterial color="#B22222" />
                    </Box>
                    
                    {/* Door Handle */}
                    <Sphere args={[0.05]} position={[0.3, 0.95, houseData.walls.depth / 2 + 0.11]}>
                        <meshLambertMaterial color="#FFD700" />
                    </Sphere>
                    
                    {/* Window Frames */}
                    <Box args={[0.7, 0.7, 0.05]} position={[-1, 1.2, houseData.walls.depth / 2 + 0.13]}>
                        <meshLambertMaterial color="#8B4513" />
                    </Box>
                    <Box args={[0.7, 0.7, 0.05]} position={[1, 1.2, houseData.walls.depth / 2 + 0.13]}>
                        <meshLambertMaterial color="#8B4513" />
                    </Box>
                </group>
            )}
            
            {/* Debris particles for demolition */}
            {(isCollapsing || interruptionDetected) && collapseAnimation > 0.5 && (
                <group>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <Box 
                            key={i}
                            args={[0.1, 0.1, 0.1]} 
                            position={[
                                (Math.random() - 0.5) * 6,
                                Math.random() * 3,
                                (Math.random() - 0.5) * 6
                            ]}
                        >
                            <meshLambertMaterial color="#8B4513" />
                        </Box>
                    ))}
                </group>
            )}
        </group>
    );
};

window.House = House;
