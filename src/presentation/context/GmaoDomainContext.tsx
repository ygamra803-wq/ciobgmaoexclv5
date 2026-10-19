import { createContext, useReducer, useContext } from 'react';

const GmaoDomainContext = createContext(null);

const initialState = {
  articles: [],
  movements: [],
  machines: [],
  users: [],
  loading: false,
  error: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ARTICLES':
      return { ...state, articles: action.payload };
    case 'ADD_ARTICLE':
      return { ...state, articles: [...state.articles, action.payload] };
    case 'UPDATE_ARTICLE':
      return {
        ...state,
        articles: state.articles.map(a =>
          a.ref === action.payload.ref ? action.payload : a
        )
      };
    case 'DELETE_ARTICLE':
      return {
        ...state,
        articles: state.articles.filter(a => a.ref !== action.payload)
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

/**
 * Gmao Domain Provider
 * ✅ مصدر موحد لإدارة حالة النطاق ومنع Data Silos
 */
export function GmaoDomainProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <GmaoDomainContext.Provider value={{ state, dispatch }}>
      {children}
    </GmaoDomainContext.Provider>
  );
}

export function useGmaoDomain() {
  const context = useContext(GmaoDomainContext);
  if (!context) {
    throw new Error('useGmaoDomain must be used within GmaoDomainProvider');
  }
  return context;
}
