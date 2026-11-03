import { createStore } from 'zustor';

export interface Participant {
  id: string;
  name: string;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface BuzzerState {
  question: string | null;
  participants: Participant[];
  teams: Team[];
  buzzedParticipants: Set<string>; // participant IDs who have already buzzed
  isLocked: boolean; // whether the buzzer is locked (after first buzz)
}

export const initialState: BuzzerState = {
  question: null,
  participants: [],
  teams: [],
  buzzedParticipants: new Set(),
  isLocked: false,
};

const store = createStore(initialState);

// Actions
store.defineActions({
  setQuestion(state, question: string) {
    state.question = question;
  },
  
  addParticipant(state, participant: Participant) {
    state.participants.push(participant);
  },
  
  removeParticipant(state, id: string) {
    state.participants = state.participants.filter(p => p.id !== id);
  },
  
  setParticipants(state, participants: Participant[]) {
    state.participants = participants;
  },
  
  addTeam(state, team: Team) {
    state.teams.push(team);
  },
  
  removeTeam(state, id: string) {
    state.teams = state.teams.filter(t => t.id !== id);
  },
  
  setTeams(state, teams: Team[]) {
    state.teams = teams;
  },
  
  addParticipantToTeam(state, participantId: string, teamId: string) {
    const participant = state.participants.find(p => p.id === participantId);
    if (participant) {
      participant.teamId = teamId;
    }
  },
  
  removeParticipantFromTeam(state, participantId: string) {
    const participant = state.participants.find(p => p.id === participantId);
    if (participant) {
      participant.teamId = undefined;
    }
  },
  
  setBuzzerLocked(state, locked: boolean) {
    state.isLocked = locked;
  },
  
  addBuzzerParticipant(state, participantId: string) {
    state.buzzedParticipants.add(participantId);
  },
  
  resetState(state) {
    state.question = null;
    state.participants = [];
    state.teams = [];
    state.buzzedParticipants.clear();
    state.isLocked = false;
  },
});

export const useStore = store.useSelector;
export default store;
