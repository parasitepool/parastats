import React, { useRef, useState, useEffect } from 'react';
import { getMerkleColor } from '../../utils/colorUtils';

interface MerkleTreeVisualizationProps {
  coinbaseTxHash?: string;
  merkleBranches?: string[];
}

interface TreeNode {
  hash: string;
  label: string;
  type: 'coinbase' | 'branch' | 'intermediate' | 'root';
  x: number;
  y: number;
  children?: [TreeNode?, TreeNode?];
}

// Define constants for layout - optimized for readability
const defaultNodeWidth = 80;
const defaultNodeHeight = 50;
const branchNodeWidth = 90; // Slightly wider for branches
const branchNodeHeight = 55; // Slightly taller for branches  
const rootNodeWidth = 100; // Wider for the root
const rootNodeHeight = 60; // Taller for the root
const horizontalSpacing = 15; // Reduced spacing for more compact layout
const levelHeight = 80; // Reasonable vertical space

const MerkleTreeVisualization: React.FC<MerkleTreeVisualizationProps> = ({
  coinbaseTxHash,
  merkleBranches = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Effect to measure container width
  useEffect(() => {
    const measureWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth || containerRef.current.clientWidth || 800; // fallback to 800px
        setContainerWidth(width);
      }
    };

    // Initial measurement
    measureWidth();

    // Set up ResizeObserver with fallback
    let observer: ResizeObserver | null = null;
    
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(entries => {
        if (entries[0]) {
          setContainerWidth(entries[0].contentRect.width || 800);
        }
      });

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }
    }

    // Fallback: use window resize event if ResizeObserver is not available
    const handleResize = () => {
      measureWidth();
    };

    window.addEventListener('resize', handleResize);

    // Also set a timeout to measure after component mounts
    const timeoutId = setTimeout(measureWidth, 100);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []); // Empty dependency array ensures this runs once on mount

  const buildTree = (): { root: TreeNode; width: number; height: number } | null => {
    if (!coinbaseTxHash) return null;

    const numBranches = merkleBranches.length;
    if (numBranches === 0) {
      // Handle case with only coinbase (becomes the root)
      const rootNode: TreeNode = {
        hash: coinbaseTxHash,
        label: 'coinbase', // Or 'root'? User might expect 'root' if no branches
        type: 'root', // Treat as root if it's the only node
        x: 0,
        y: 0,
      };

      // Base width/height for a single node
      return { root: rootNode, width: defaultNodeWidth, height: defaultNodeHeight };
    }

    // Create the initial coinbase node (will be at the deepest level)
    let currentNode: TreeNode = {
      hash: coinbaseTxHash,
      label: 'coinbase',
      type: 'coinbase',
      x: 0, // Placeholder, calculated later
      y: 0 // Placeholder, calculated later
    };

    // Iteratively build the tree upwards
    for (let i = 0; i < numBranches; i++) {
      const branchNode: TreeNode = {
        hash: merkleBranches[i],
        label: `branch${i}`,
        type: 'branch',
        x: 0, // Placeholder
        y: 0 // Placeholder
      };

      const parentNode: TreeNode = {
        // Don't simulate hash, just use placeholder. Keep unique for potential key usage if needed.
        hash: `intermediate-${i}`,
        label: '', // Intermediate nodes show 'Hash' label later
        type: 'intermediate',
        x: 0, // Placeholder
        y: 0, // Placeholder
        // Left child is the result of previous hashes, right child is the new branch
        children: [currentNode, branchNode]
      };

      currentNode = parentNode; // Move up to the parent for the next iteration
    }

    // The final node after all iterations is the root
    currentNode.type = 'root';
    currentNode.label = 'merkle root';

    // --- Calculate Positions ---
    // 1. Assign levels/depth (y coordinate) starting from root=0
    const assignLevels = (node: TreeNode, level: number) => {
      node.y = level;
      if (node.children) {
        node.children.forEach(child => {
          if (child) assignLevels(child, level + 1);
        });
      }
    };
    assignLevels(currentNode, 0);

    // 2. Find max depth to calculate tree height
    let maxDepth = 0;
    const findMaxDepth = (node: TreeNode) => {
      maxDepth = Math.max(maxDepth, node.y);
      if (node.children) {
        node.children.forEach(child => {
          if (child) findMaxDepth(child);
        });
      }
    };
    findMaxDepth(currentNode);

    // Calculate base height needed for the drawing content - use max of branch/root height
    const treeContentHeight = (maxDepth * levelHeight) + Math.max(branchNodeHeight, rootNodeHeight);

    // 3. Assign X coordinates based on leaf positions and track max extent
    let leafCounter = 0;
    let maxNodeX = 0; // Track the rightmost edge

    const assignXPositions = (node: TreeNode): number => {
      // Returns the CENTER x of the node
      const isLargeNode = node.type === 'branch' || node.type === 'coinbase';
      const currentWidth = isLargeNode ? branchNodeWidth : defaultNodeWidth;

      // Check if it's a leaf in *this specific* tree structure
      // Leaves are the 'coinbase' node and all 'branch' nodes
      const isLeaf = node.type === 'coinbase' || node.type === 'branch';

      if (isLeaf) {
        // Assign X position based on the order leaves are encountered (left-to-right)
        node.x = leafCounter * (currentWidth + horizontalSpacing);
        leafCounter++;
        maxNodeX = Math.max(maxNodeX, node.x + currentWidth); // Update max extent
        return node.x + currentWidth / 2; // Return center for parent calculation
      } else {
        // Intermediate or root node: Center above its children
        let totalX = 0;
        let validChildrenCount = 0; // Count only non-null children

        if (node.children?.[0]) {
          totalX += assignXPositions(node.children[0]);
          validChildrenCount++;
        }
        if (node.children?.[1]) {
          totalX += assignXPositions(node.children[1]);
          validChildrenCount++;
        }

        // Avoid division by zero if a node unexpectedly has no children processed
        node.x = validChildrenCount > 0 ? totalX / validChildrenCount : 0;

        // Assign the node's top-left X based on its center and width
        const parentWidth = node.type === 'root' ? rootNodeWidth : defaultNodeWidth;
        node.x = node.x - parentWidth / 2;

        // Update max extent based on the parent node itself
        maxNodeX = Math.max(maxNodeX, node.x + parentWidth);

        return node.x + parentWidth / 2; // Return the calculated center X
      }
    };

    assignXPositions(currentNode); // Start assignment from the root

    // 4. Calculate required content width based on the maximum extent found
    const treeContentWidth = maxNodeX; // The width is the rightmost edge reached

    return { 
      root: currentNode, 
      width: treeContentWidth, 
      height: treeContentHeight 
    };
  };

  // --- Helper function to find specific nodes by condition ---
  const findNode = (node: TreeNode | null, condition: (n: TreeNode) => boolean): TreeNode | null => {
    if (!node) return null;
    if (condition(node)) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child || null, condition);
        if (found) return found;
      }
    }
    return null;
  };

  const treeData = buildTree();

  // Find the nodes needed for the line calculation
  const coinbaseNode = treeData ? findNode(treeData.root, n => n.type === 'coinbase') : null;
  const branch0Node = treeData ? findNode(treeData.root, n => n.label === 'branch0') : null;

  // Conditional rendering if tree can't be built
  if (!treeData || !coinbaseNode || !branch0Node) {
    // Ensure nodes are found
    return (
      <div className="text-center py-8 text-accent-3">
        {coinbaseTxHash ? "Building tree..." : "No merkle tree data available (missing coinbase hash)"}
      </div>
    );
  }

  // Use fallback width if container width is not measured yet
  const effectiveContainerWidth = containerWidth || 800;

  const { root: tree, width: treeContentWidth, height: treeContentHeight } = treeData;

  // Calculate line coordinates
  const linePadding = 15;
  const lineVerticalSpacing = 15;
  const lineY = (coinbaseNode.y * levelHeight) - lineVerticalSpacing;
  const lineX1 = coinbaseNode.x - linePadding;
  // Use branch0's specific width (branchNodeWidth)
  const lineX2 = branch0Node.x + branchNodeWidth + linePadding;

  // --- Calculate SVG Dimensions based on Container ---
  const padding = defaultNodeWidth / 1.5; // Add some padding around the content
  const viewBoxWidth = Math.max(treeContentWidth, lineX2 + padding); // Ensure viewBox includes the line
  const viewBoxHeight = treeContentHeight + 2 * padding;

  // Improved scaling logic with minimum scale to maintain readability
  let svgWidth: number | string;
  let svgHeight: number;
  
  const contentWidth = viewBoxWidth - 2 * padding;
  const contentHeight = viewBoxHeight - 2 * padding;
  const minScale = 0.7; // Minimum scale factor to maintain readability

  if (contentWidth <= effectiveContainerWidth) {
    // Content fits naturally
    svgWidth = contentWidth;
    svgHeight = contentHeight;
  } else {
    // Content needs to be scaled down
    const scaleFactor = Math.max(minScale, effectiveContainerWidth / contentWidth);
    svgWidth = "100%";
    svgHeight = contentHeight * scaleFactor;
  }

  const renderNode = (node: TreeNode) => {
    const isLargeNode = node.type === 'branch' || node.type === 'coinbase';
    let currentWidth = isLargeNode ? branchNodeWidth : defaultNodeWidth;
    let currentHeight = isLargeNode ? branchNodeHeight : defaultNodeHeight;

    if (node.type === 'root') {
      currentWidth = rootNodeWidth;
      currentHeight = rootNodeHeight;
    }

    // Adjust xPos to center potentially wider nodes around the calculated center point
    const xPos = node.x; // Node X is already top-left based on assignXPositions
    const yPos = node.y * levelHeight;

    // Determine color and style based on node type
    let bgColorClass = '';
    let inlineStyle = {};
    let textColorClass = 'text-white';

    if (node.type === 'branch') {
      const nodeColor = getMerkleColor(node.hash);
      inlineStyle = { backgroundColor: nodeColor };
      textColorClass = 'text-black';
    } else if (node.type === 'root') {
      bgColorClass = 'bg-red-500';
    } else if (node.type === 'coinbase') {
      bgColorClass = 'bg-green-500';
    } else {
      // Intermediate node
      bgColorClass = 'bg-gray-500';
    }

    // Determine if title should be shown (only for leaves)
    const showTitle = node.type === 'coinbase' || node.type === 'branch';

    // Define border class based on whether it's a transaction - Back to Border approach
    const borderStyleClass = 'border border-solid border-black/20 dark:border-white/20'; // Standard border for all nodes

    // Define dummy node dimensions here
    const dummyWidth = defaultNodeWidth * 0.5; // Smaller than real nodes
    const dummyHeight = defaultNodeHeight * 0.5;
    const dummySpacing = 8;

    return (
      <g key={node.hash}>
        {/* Draw lines to children */}
        {node.children?.map((child, index) => {
          if (!child) return null;

          // Child position from its own pre-calculated data
          const childYPos = child.y * levelHeight;

          return (
            <line
              key={`line-${index}`}
              x1={xPos + currentWidth / 2}
              y1={yPos + currentHeight}
              x2={child.x + (child.type === 'branch' || child.type === 'coinbase' ? branchNodeWidth : defaultNodeWidth) / 2}
              y2={childYPos}
              stroke="#666666"
              strokeWidth="2"
            />
          );
        })}

        {/* Draw node */}
        <foreignObject x={xPos} y={yPos} width={currentWidth} height={currentHeight}>
          <div
            className={`w-full h-full flex flex-col items-center justify-center ${bgColorClass} ${textColorClass} ${borderStyleClass} font-medium px-2`}
            style={inlineStyle}
            title={showTitle ? node.hash : undefined}
          >
            {/* Custom content based on node type */}
            {node.type === 'branch' ? (
              <div className="text-center">
                <div className="font-bold text-sm mb-1">{node.label}</div>
                <div className="text-xs opacity-80 font-mono">
                  {node.hash.substring(0, 6)}...
                </div>
              </div>
            ) : node.type === 'coinbase' ? (
              <div className="text-center">
                <div className="font-bold text-sm mb-1">coinbase</div>
                <div className="text-xs opacity-80 font-mono">
                  {node.hash.substring(0, 6)}...
                </div>
              </div>
            ) : node.type === 'root' ? (
              <div className="text-center">
                <div className="font-bold text-base">merkle root</div>
              </div>
            ) : (
              // Intermediate node
              <div className="text-center">
                <div className="font-semibold text-sm">Hash</div>
              </div>
            )}
          </div>
        </foreignObject>

        {/* Add "Transactions" label next to branch0 */}
        {node.label === 'branch0' && (
          <text
            x={xPos + currentWidth + 10}
            y={yPos + currentHeight / 2}
            className="text-sm text-accent-2 fill-current"
            dominantBaseline="middle"
          >
            ← Transactions
          </text>
        )}

        {/* Draw dummy nodes below branches (but not branch0) */}
        {node.type === 'branch' && node.label !== 'branch0' && (
          <g>
            {/* First dummy rect */}
            <rect
              x={xPos + (currentWidth - dummyWidth) / 2}
              y={yPos + currentHeight + dummySpacing}
              width={dummyWidth}
              height={dummyHeight}
              className="fill-gray-400 opacity-50"
            />
            
            {/* Second dummy rect */}
            <rect
              x={xPos + (currentWidth - dummyWidth) / 2}
              y={yPos + currentHeight + dummySpacing * 2 + dummyHeight}
              width={dummyWidth}
              height={dummyHeight}
              className="fill-gray-400 opacity-50"
            />
            
            {/* Third dummy rect */}
            <rect
              x={xPos + (currentWidth - dummyWidth) / 2}
              y={yPos + currentHeight + dummySpacing * 3 + dummyHeight * 2}
              width={dummyWidth}
              height={dummyHeight}
              className="fill-gray-400 opacity-50"
            />
            
            {/* Ellipsis */}
            <text
              x={xPos + currentWidth / 2}
              y={yPos + currentHeight + dummySpacing * 4 + dummyHeight * 3}
              className="text-xs text-gray-400 fill-current"
              textAnchor="middle"
            >
              ...
            </text>
          </g>
        )}

        {/* Render children recursively */}
        {node.children?.map(child => child && renderNode(child))}
      </g>
    );
  };

  return (
    <div ref={containerRef} className="w-full">
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="overflow-visible"
          style={{ minWidth: contentWidth * 0.7 }} // Ensure minimum readable size
        >
          {/* Render the dashed line */}
          <line
            x1={lineX1}
            y1={lineY}
            x2={lineX2}
            y2={lineY}
            stroke="#666666"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Render the tree nodes */}
          {renderNode(tree)}
        </svg>
      </div>
    </div>
  );
};

export default MerkleTreeVisualization;
