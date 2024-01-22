import axios from 'axios';
import { getAuthHeader } from './config';

export const baseURL = '/cheatingDetection';

const batchInc = async (examId) => {
  try {
    await axios.post(`${baseURL}/checkCheating`, { examId: examId }, getAuthHeader());
    // No cheating detected
    return {};
  } catch (error) {
    // Cheating detected
    console.error('Cheating detected:', error.response.data.error);
    // Display an alert or handle the error in a more user-friendly way
    alert('Cheating detected! Please follow the rules.');
    // Optionally, you can rethrow the error if needed
    throw error;
  }
};

const clear = async () => {
  try {
    const response = await axios.delete(`${baseURL}/clear`, getAuthHeader());
    return response.data;
  } catch (error) {
    console.error('Error while clearing:', error.response.data.error);
    // Display an alert or handle the error in a more user-friendly way
    alert('Error while clearing. Please try again.');
    // Optionally, you can rethrow the error if needed
    throw error;
  }
};

const cheatingService = { batchInc, clear };

export default cheatingService;
