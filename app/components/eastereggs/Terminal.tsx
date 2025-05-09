"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";

type TerminalProps = {
  onClose: () => void;
};

type CommandHistory = {
  command: string;
  response: string;
  isGenesisBlock?: boolean;
};

// Morse code for "HAL"
const HAL_MORSE = ".... .- .-..";

// Bitcoin-related data
const BITCOIN_DATA = {
  block9: {
    height: 9,
    recipient: "1PSSGeFHDnKNxiEyFrD1wcEaHr9hrQDDWc",
    amount: "10 BTC",
    to: "Hal Finney",
    from: "Satoshi Nakamoto",
    timestamp: "January 12, 2009",
    blockHash:
      "00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048",
    significance:
      "This transaction marked the first real-world use of Bitcoin, demonstrating its viability as a peer-to-peer electronic cash system",
  },
  satoshi: {
    identity: "Unknown",
    knownFor: "2007 - designed the original bitcoin protocol, 2008 - released the whitepaper, 2009 - launched the network",
    lastActive: "April 23, 2011",
    lastMessage: "I've moved on to other things",
  },
  hal: {
    fullName: "Harold Thomas Finney II",
    lived: "May 4, 1956 - August 28, 2014",
    quote: "Running bitcoin",
    tweetDate: "January 10, 2009",
    legacy: "Cryonically preserved at Alcor Life Extension Foundation",
  },
};

// Raw hex data for Genesis Block visualization
const GENESIS_BLOCK_HEX = [
  "00000000   01 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00   ................",
  "00000010   00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00   ................",
  "00000020   00 00 00 00 3B A3 ED FD  7A 7B 12 B2 7A C7 2C 3E   ....;£íýz{.²zÇ,>",
  "00000030   67 76 8F 61 7F C8 1B C3  88 8A 51 32 3A 9F B8 AA   gv.a.È.Ã^ŠQ2:Ÿ¸ª",
  "00000040   4B 1E 5E 4A 29 AB 5F 49  FF FF 00 1D 1D AC 2B 7C   K.^J)«_Iÿÿ...¬+|",
  "00000050   01 01 00 00 00 01 00 00  00 00 00 00 00 00 00 00   ................",
  "00000060   00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00   ................",
  "00000070   00 00 00 00 00 00 FF FF  FF FF 4D 04 FF FF 00 1D   ..........M.ÿÿ..",
  "00000080   01 04 45 54 68 65 20 54  69 6D 65 73 20 30 33 2F   ..EThe Times 03/",
  "00000090   4A 61 6E 2F 32 30 30 39  20 43 68 61 6E 63 65 6C   Jan/2009 Chancel",
  "000000A0   6C 6F 72 20 6F 6E 20 62  72 69 6E 6B 20 6F 66 20   lor on brink of ",
  "000000B0   73 65 63 6F 6E 64 20 62  61 69 6C 6F 75 74 20 66   second bailout f",
  "000000C0   6F 72 20 62 61 6E 6B 73  FF FF FF FF 01 00 F2 05   or banksÿÿÿÿ..ò.",
  "000000D0   2A 01 00 00 00 43 41 04  67 8A FD B0 FE 55 48 27   *....CA.gŠý°þUH",
  "000000E0   19 67 F1 A6 71 30 B7 10  5C D6 A8 28 E0 39 09 A6   .gñ¦q0·.\\Ö¨(à9.¦",
  "000000F0   79 62 E0 EA 1F 61 DE B6  49 F6 BC 3F 4C EF 38 C4   ybàê.aÞ¶Iö¼?Lï8Ä",
  "00000100   F3 55 04 E5 1E C1 12 DE  5C 38 4D F7 BA 0B 8D 57   óU.å.Á.Þ\\8M÷º..W",
  "00000110   8A 4C 70 2B 6B F1 1D 5F  AC 00 00 00 00            ŠLp+kñ._¬....",
];

// Sarcastic responses for unrecognized commands
const UNRECOGNIZED_RESPONSES = [
  "I'm afraid I can't do anything with that.",
  "What?",
  "Error 404: Command not found.",
  "Okay, what am I supposed to do with that?",
  "Have you tried turning it off and... no, just off is fine.",
  "I'm a terminal, not a mind reader.",
  "That's one way to make absolutely nothing happen.",
  "Fascinating command. Wrong, but fascinating.",
  "Maybe try sudo rm -rf /",
  "Try again... or don't."
];

export const Terminal = ({ onClose }: TerminalProps) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [currentMorseIndex, setCurrentMorseIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [genesisBlockLines, setGenesisBlockLines] = useState<string[]>([]);

  // Command history navigation
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const commandLineRef = useRef<HTMLDivElement>(null);

  // Helper to get cursor position
  const updateCursorPosition = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  };

  // Focus input when terminal opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history, genesisBlockLines]);

  // Genesis Block animation
  useEffect(() => {
    if (!isAnimating) return;

    let currentLineIndex = 0;
    const totalLines = GENESIS_BLOCK_HEX.length;

    // Clear the genesis block lines
    //setGenesisBlockLines([]);

    const animationInterval = setInterval(() => {
      if (currentLineIndex >= totalLines) {
        clearInterval(animationInterval);
        setIsAnimating(false);

        // When animation completes, add the genesis block to history
        const genesisBlockOutput = GENESIS_BLOCK_HEX.join("\n");
        setHistory((prev) => [
          ...prev,
          {
            command: "",
            response: genesisBlockOutput,
            isGenesisBlock: true,
          },
        ]);

        // Clear the separate genesis block lines
        setGenesisBlockLines([]);

        // Set focus back to the input with a small delay
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
        return;
      }

      // Add the current line to the display
      setGenesisBlockLines((prev) => [
        ...prev,
        GENESIS_BLOCK_HEX[currentLineIndex],
      ]);
      currentLineIndex++;
    }, 200); // Adjust timing for animation speed

    return () => clearInterval(animationInterval);
  }, [isAnimating]);

  // Morse code blinking cursor
  useEffect(() => {
    const morseCode = HAL_MORSE;

    const interpretMorseTimings = () => {
      const currentChar = morseCode[currentMorseIndex];

      // Timing in milliseconds
      let timing = 100; // Default for short gaps

      if (currentChar === ".") {
        timing = 200; // Dit (short)
      } else if (currentChar === "-") {
        timing = 600; // Dah (long)
      } else if (currentChar === " ") {
        timing = 700; // Space between letters
      }

      return timing;
    };

    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);

      // Only increment index when cursor blinks on
      if (!cursorVisible) {
        setCurrentMorseIndex((prev) => (prev + 1) % morseCode.length);
      }
    }, interpretMorseTimings());

    return () => clearInterval(interval);
  }, [cursorVisible, currentMorseIndex]);

  // Add executed command to command history stack
  const addToCommandHistory = useCallback(
    (cmd: string) => {
      // Don't add empty commands or duplicates of the last command
      if (
        !cmd.trim() ||
        (commandHistory.length > 0 && commandHistory[0] === cmd)
      ) {
        return;
      }

      setCommandHistory((prev) => [cmd, ...prev]);
      setHistoryIndex(-1); // Reset history index after executing a command
    },
    [commandHistory]
  );

  const handleCommand = useCallback(() => {
    if (!input.trim() || isAnimating) return;

    let response = UNRECOGNIZED_RESPONSES[Math.floor(Math.random() * UNRECOGNIZED_RESPONSES.length)];
    const command = input.toLowerCase().trim();

    // Add command to command history for up/down navigation
    addToCommandHistory(input);

    // Process commands
    if (command === "block9" || command === "block 9") {
      response = JSON.stringify(BITCOIN_DATA.block9, null, 2);
    } else if (
      command === "genesis" ||
      command === "block0" ||
      command === "block 0"
    ) {
      // Start the Genesis Block animation
      setHistory((prev) => [
        ...prev,
        { command: input, response: "Loading Genesis Block..." },
      ]);
      setIsAnimating(true);
      setInput("");
      return;
    } else if (command === "omb") {
        response = "Cannot be Stopped";
    } else if (command === "satoshi") {
      response = JSON.stringify(BITCOIN_DATA.satoshi, null, 2);
    } else if (command === "hal") {
      response = JSON.stringify(BITCOIN_DATA.hal, null, 2);
    } else if (command === "date") {
      const currentDate = new Date();
      const genesisDate = new Date("January 3, 2009");
      const diffTime = currentDate.getTime() - genesisDate.getTime();
      
      // Calculate years, months, days
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = diffDays % 30;
      
      response = `${currentDate.toString()}\n\nTime since Bitcoin Genesis Block (January 3, 2009):\n${years} years, ${months} months, ${days} days`;
    } else if (command === "clear") {
      setHistory([]);
      setGenesisBlockLines([]);
      setInput("");
      return;
    } else if (command === "exit" || command === "quit" || command === "sudo rm -rf /") {
      onClose();
      return;
    }

    setHistory((prev) => [...prev, { command: input, response }]);
    setInput("");
    setCursorPosition(0); // Reset cursor position
  }, [input, onClose, addToCommandHistory, isAnimating]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent handling key events during animation
    if (isAnimating) {
      e.preventDefault();
      return;
    }

    // Update cursor position after a brief delay to ensure it's updated after the key is processed
    setTimeout(updateCursorPosition, 0);

    if (e.key === "Enter") {
      handleCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); // Prevent cursor from moving to beginning of input

      // Save current input when starting to navigate history
      if (historyIndex === -1 && input) {
        setSavedInput(input);
      }

      // Navigate up through command history
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
        // Set cursor at end of input after retrieving from history
        setTimeout(() => {
          if (inputRef.current) {
            const length = commandHistory[newIndex].length;
            inputRef.current.setSelectionRange(length, length);
            updateCursorPosition();
          }
        }, 0);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); // Prevent cursor from moving to end of input

      // Navigate down through command history
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
        // Set cursor at end of input after retrieving from history
        setTimeout(() => {
          if (inputRef.current) {
            const length = commandHistory[newIndex].length;
            inputRef.current.setSelectionRange(length, length);
            updateCursorPosition();
          }
        }, 0);
      } else if (historyIndex === 0) {
        // Return to saved input when reaching the bottom of history
        setHistoryIndex(-1);
        setInput(savedInput);
        setSavedInput("");
        // Set cursor at end of input
        setTimeout(() => {
          if (inputRef.current) {
            const length = savedInput.length;
            inputRef.current.setSelectionRange(length, length);
            updateCursorPosition();
          }
        }, 0);
      }
    } else if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      // Update cursor position for navigation keys
      setTimeout(updateCursorPosition, 0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAnimating) return;
    setInput(e.target.value);
    // Update cursor position after input changes
    setTimeout(updateCursorPosition, 0);
  };

  const handleClick = () => {
    // Update cursor position when clicking in the input
    setTimeout(updateCursorPosition, 0);
  };

  // Handle click outside input to refocus
  const handleContainerClick = (e: React.MouseEvent) => {
    // Prevent the click from bubbling up to the overlay (which would close the terminal)
    e.stopPropagation();

    // Refocus input when clicking anywhere in the terminal container
    if (inputRef.current && e.target !== inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/90"
      onClick={onClose}
    >
      {/* CRT overlay effect with scan lines */}
      <div
        className="fixed inset-0 z-50 pointer-events-none bg-repeat opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(transparent 50%, rgba(0, 0, 0, 0.8) 50%)",
          backgroundSize: "100% 4px",
        }}
      ></div>

      <motion.div
        className={`mx-auto mt-16 w-full max-w-5xl h-[80vh] p-4 bg-black/80 border-2 border-foreground rounded-md overflow-hidden shadow-lg`}
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onClick={handleContainerClick}
      >
        <div className="flex items-center justify-between mb-2 border-b border-foreground/30 pb-1">
          <div className="text-foreground text-sm font-bold">
            Parasite Terminal v0.1.0
          </div>
          <button
            className="text-foreground/80 hover:text-foreground cursor-pointer text-xl"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div
          ref={terminalRef}
          className="h-[calc(100%-60px)] overflow-y-auto scrollbar-hide pb-2 text-sm relative"
        >
          {/* Command history */}
          {history.map((item, index) => (
            <div key={index} className="mb-2">
              {item.command && (
                <div className="flex">
                  <span className="text-foreground/80 mr-2">&gt;</span>
                  <span className="text-foreground">{item.command}</span>
                </div>
              )}
              <pre
                className={`text-foreground/80 ${
                  item.command ? "pl-4" : ""
                } mt-1 whitespace-pre overflow-x-auto text-[0.75rem]`}
              >
                {item.response}
              </pre>
            </div>
          ))}

          {/* Genesis Block animation in progress */}
          {genesisBlockLines.length > 0 && (
            <div className="my-2">
              {genesisBlockLines.map((line, index) => (
                <pre
                  key={index}
                  className="text-foreground/80 whitespace-pre overflow-x-auto text-[0.75rem]"
                >
                  {line}
                </pre>
              ))}
            </div>
          )}

          {/* Current command line */}
          <div className="flex items-center">
            <span className="text-foreground/80 mr-2">&gt;</span>
            <div ref={commandLineRef} className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleChange}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none outline-none text-foreground caret-transparent"
                style={{ touchAction: "manipulation" }}
                autoFocus
                disabled={isAnimating}
              />
              {/* Position the cursor absolutely based on character position */}
              <div
                className="absolute top-0 pointer-events-none"
                style={{
                  left: `${cursorPosition * 0.6}em`, // Adjust multiplier based on your font
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  className={`w-2 h-5 ${
                    cursorVisible && !isAnimating
                      ? "bg-foreground"
                      : "bg-transparent"
                  }`}
                ></span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
