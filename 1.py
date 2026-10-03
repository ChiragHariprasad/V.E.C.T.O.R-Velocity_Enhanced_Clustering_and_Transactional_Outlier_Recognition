import random
import json
import os

# To expand this to 500 questions, you can save them in a 'equations.json' file.
# The program checks if that file exists; if not, it uses this starter database.
STARTER_EQUATIONS = [
    # Basic / Simple Exchange (Double Displacement)
    {"category": "Simple Exchange", "difficulty": "Basic", "reactants": "HCl + NaOH ->", "products": "NaCl + H2O"},
    {"category": "Simple Exchange", "difficulty": "Basic", "reactants": "AgNO3 + NaCl ->", "products": "AgCl + NaNO3"},
    
    # Transposition / Single Displacement
    {"category": "Transposition", "difficulty": "Medium", "reactants": "Zn + 2HCl ->", "products": "ZnCl2 + H2"},
    {"category": "Transposition", "difficulty": "Medium", "reactants": "CuSO4 + Fe ->", "products": "FeSO4 + Cu"},
    
    # Rust / Degradation
    {"category": "Rust/Degradation", "difficulty": "Medium", "reactants": "4Fe + 3O2 + 6H2O ->", "products": "4Fe(OH)3 [Hydrated Iron(III) Oxide]"},
    {"category": "Rust/Degradation", "difficulty": "Complex", "reactants": "2Ag + H2S ->", "products": "Ag2S + H2 [Silver Tarnish]"},
    
    # Organic
    {"category": "Organic (Combustion)", "difficulty": "Basic", "reactants": "CH4 + 2O2 ->", "products": "CO2 + 2H2O"},
    {"category": "Organic (Esterification)", "difficulty": "Complex", "reactants": "CH3COOH + C2H5OH ->", "products": "CH3COOC2H5 + H2O [Ethyl Acetate]"},
    {"category": "Organic (Saponification)", "difficulty": "Complex", "reactants": "(C17H35COO)3C3H5 + 3NaOH ->", "products": "3C17H35COONa + C3H5(OH)3 [Soap + Glycerol]"},
    
    # Inorganic
    {"category": "Inorganic (Synthesis)", "difficulty": "Medium", "reactants": "N2 + 3H2 -> (Haber Process)", "products": "2NH3"},
    {"category": "Inorganic (Decomposition)", "difficulty": "Medium", "reactants": "2KClO3 -> (Heat/MnO2)", "products": "2KCl + 3O2"},
    
    # Redox (Reduction-Oxidation)
    {"category": "Redox", "difficulty": "Complex", "reactants": "MnO4- + 8H+ + 5Fe2+ ->", "products": "Mn2+ + 5Fe3+ + 4H2O"},
    {"category": "Redox", "difficulty": "Most Complex", "reactants": "Cr2O7(2-) + 14H+ + 6I- ->", "products": "2Cr3+ + 3I2 + 7H2O"},
    
    # Nuclear
    {"category": "Nuclear (Alpha Decay)", "difficulty": "Complex", "reactants": "^238_92 U ->", "products": "^234_90 Th + ^4_2 He"},
    {"category": "Nuclear (Fission)", "difficulty": "Most Complex", "reactants": "^235_92 U + ^1_0 n ->", "products": "^141_56 Ba + ^92_36 Kr + 3 ^1_0 n"}
]

def load_equations():
    """Loads equations from a JSON file if it exists, otherwise uses the starter list."""
    if os.path.exists("equations.json"):
        with open("equations.json", "r") as file:
            return json.load(file)
    return STARTER_EQUATIONS

def play_chemistry_duel():
    equations = load_equations()
    random.shuffle(equations)
    
    scores = {"Laya": 0, "Jev": 0}
    players = ["Laya", "Jev"]
    turn_index = 0
    
    print("="*50)
    print("🧪 WELCOME TO THE ULTIMATE CHEMISTRY DUEL 🧪")
    print(f"Loaded {len(equations)} equations spanning all difficulty levels.")
    print("="*50)
    print("Rules: Write the correct products (and coefficients if applicable).")
    print("Since chemical order doesn't matter (A+B = B+A), the game will show")
    print("the expected answer and ask if you got it chemically correct.\n")
    
    for i, eq in enumerate(equations):
        current_player = players[turn_index % 2]
        print(f"\n--- Question {i+1} / {len(equations)} ---")
        print(f"Player: {current_player}")
        print(f"Category: {eq['category']} ({eq['difficulty']})")
        print(f"Equation: {eq['reactants']}")
        
        # Get the player's typed answer
        player_answer = input(f"{current_player}'s Answer: ")
        
        # Reveal the exact chemical products
        print(f"\nExpected Products: {eq['products']}")
        
        # Self-evaluation (or arbiter evaluation) to account for alternative writing formats
        while True:
            correct = input(f"Did {current_player} get this right? (y/n): ").strip().lower()
            if correct in ['y', 'yes']:
                print(f"✅ Correct! +1 point to {current_player}.")
                scores[current_player] += 1
                break
            elif correct in ['n', 'no']:
                print("❌ Incorrect.")
                break
            else:
                print("Please enter 'y' or 'n'.")
                
        # Print current standings
        print(f"Current Score -> Laya: {scores['Laya']} | Jev: {scores['Jev']}")
        
        turn_index += 1
        
        # Allow early exit
        if i < len(equations) - 1:
            cont = input("\nPress Enter for next question (or type 'quit' to end): ").strip().lower()
            if cont == 'quit':
                break

    # Final Score Output
    print("\n" + "="*50)
    print("🏆 FINAL SCORES 🏆")
    print(f"Laya: {scores['Laya']}")
    print(f"Jev: {scores['Jev']}")
    
    if scores['Laya'] > scores['Jev']:
        print("Winner: Laya! 🎉")
    elif scores['Jev'] > scores['Laya']:
        print("Winner: Jev! 🎉")
    else:
        print("It's a tie! 🤝")
    print("="*50)

if __name__ == "__main__":
    play_chemistry_duel()