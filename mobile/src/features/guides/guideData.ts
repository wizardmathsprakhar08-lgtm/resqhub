import { FirstAidGuide } from '../../types';

export const FIRST_AID_GUIDES: FirstAidGuide[] = [
  {
    id: 'burns',
    title: 'Burns & Scalds',
    category: 'Thermal Injury',
    description: 'Immediate first response steps for thermal, scald, and chemical burns.',
    criticalWarning: 'NEVER apply ice directly to a burn, as it causes severe tissue damage. Never break blisters.',
    steps: [
      {
        letter: 'A',
        title: 'Cool the Burn',
        description: 'Hold the burned area under cool (not cold) running water or apply a clean, wet compress for at least 10–20 minutes until the pain eases.',
      },
      {
        letter: 'B',
        title: 'Remove Constricting Items',
        description: 'Carefully remove rings, watches, or loose clothing near the burn before swelling begins. Do not remove items melted to the skin.',
      },
      {
        letter: 'C',
        title: 'Apply Soothing Lotion',
        description: 'Once the burn is completely cooled, apply a pure aloe vera gel or water-based moisturizer to prevent drying and provide pain relief.',
      },
      {
        letter: 'D',
        title: 'Bandage Loosely',
        description: 'Cover the area with a sterile, non-adherent gauze bandage. Wrap loosely to avoid pressure on burned skin and shield against infection.',
      },
      {
        letter: 'E',
        title: 'Manage Pain & Hydration',
        description: 'Over-the-counter pain relievers (ibuprofen or paracetamol) can alleviate pain. If burn exceeds the size of a palm, seek emergency medical care immediately.',
      },
    ],
  },
  {
    id: 'fractures',
    title: 'Bone Fractures & Sprains',
    category: 'Orthopedic Emergency',
    description: 'Critical stabilization procedure for suspected broken bones and dislocated joints.',
    criticalWarning: 'Do not attempt to push protruding bones back into the wound or realign an abnormally bent limb.',
    steps: [
      {
        letter: 'A',
        title: 'Immobilize the Person',
        description: 'Keep the person still. Do NOT move them unless in immediate danger, especially if fracture of skull, spine, pelvis, or thigh bone is suspected.',
      },
      {
        letter: 'B',
        title: 'Control Any Bleeding',
        description: 'If skin is torn, apply firm pressure around the edges with a clean sterile dressing. If bone is protruding, cover gently with sterile gauze.',
      },
      {
        letter: 'C',
        title: 'Support the Injured Limb',
        description: 'Place a soft support (folded jacket, towel, or pillow) beneath the limb to relieve strain without forcing bone movement.',
      },
      {
        letter: 'D',
        title: 'Apply a Rigid Splint',
        description: 'Use a rigid item (wooden board, rolled newspaper, or cardboard) extended across the joints above and below the break. Secure gently with cloth strips.',
      },
      {
        letter: 'E',
        title: 'Withhold Food & Drink',
        description: 'Do not give the patient anything to eat or drink in case emergency anesthesia and surgical repair are required at the hospital.',
      },
    ],
  },
  {
    id: 'bleeding',
    title: 'Severe Bleeding & Wounds',
    category: 'Circulatory Emergency',
    description: 'Lifesaving hemorrhage control for major arterial or venous bleeding.',
    criticalWarning: 'Do NOT remove knives, glass, or impaled objects from the wound; pack dressings around them to stabilize.',
    steps: [
      {
        letter: 'A',
        title: 'Lie Down & Elevate',
        description: 'Have the injured person lie down flat. If a limb is bleeding, elevate it gently above heart level unless a fracture is suspected.',
      },
      {
        letter: 'B',
        title: 'Apply Direct Pressure',
        description: 'Firmly press a sterile gauze pad or clean cloth directly over the wound using your hand or palms until bleeding slows.',
      },
      {
        letter: 'C',
        title: 'Stabilize Impaled Objects',
        description: 'If an object is embedded in the wound, leave it in place. Apply pressure to both sides around the object to stem bleeding.',
      },
      {
        letter: 'D',
        title: 'Layer Extra Dressings',
        description: 'If blood seeps through the initial dressing, DO NOT remove it. Place fresh pads directly on top and wrap firmly with a bandage.',
      },
      {
        letter: 'E',
        title: 'Watch for Shock',
        description: 'Keep the person warm with a blanket. Monitor breathing and pulse continuously until emergency responders arrive.',
      },
    ],
  },
  {
    id: 'choking',
    title: 'Adult Choking (Heimlich Maneuver)',
    category: 'Respiratory Emergency',
    description: 'Airway clearance technique for an unresponsive or choking individual.',
    criticalWarning: 'Only perform back blows and abdominal thrusts if the person cannot cough, breathe, or speak.',
    steps: [
      {
        letter: 'A',
        title: 'Encourage Coughing',
        description: 'If the person can cough forcefully, urge them to keep coughing. Do not slap their back while they are coughing.',
      },
      {
        letter: 'B',
        title: 'Deliver 5 Back Blows',
        description: 'Lean the person forward. Give 5 sharp blows between their shoulder blades using the heel of your hand.',
      },
      {
        letter: 'C',
        title: 'Perform 5 Abdominal Thrusts',
        description: 'Stand behind them, wrap your arms around their waist. Make a fist just above the navel, grasp with other hand, and pull inward and upward sharply.',
      },
      {
        letter: 'D',
        title: 'Repeat Cycle',
        description: 'Alternate between 5 back blows and 5 abdominal thrusts until the airway is cleared or emergency services arrive.',
      },
    ],
  },
];
