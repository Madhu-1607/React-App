// Import necessary modules and models
const CheatingBatchCount = require('../../models/cheatingBatchCount');
const User = require('../../models/user');
const { Assessment } = require('../../models/assessment');
const {
  pushNotification,
  createNotification,
  editNotification,
  deleteNotification,
  broadcastToUsers,
  getNotificationsOfUser
} = require('../notificationController/notificationController');
const axios = require('axios');

const awsCheatingDetectionUrl = '';

// Function to call Lambda for cheating detection
const callLambdaForCheatingDetection = async (user, examId) => {
  try {
    const cheatingBatchCount = await CheatingBatchCount.findOne({ student: user }).exec();

    if (!cheatingBatchCount) {
      // Create a new counter if it doesn't exist
      const newCheatingBatchCount = new CheatingBatchCount({ student: user });
      await newCheatingBatchCount.save();
      console.log('New counter added');
    } else {
      // Increment the existing counter
      const count = cheatingBatchCount.counter + 1;

      if (count === 7) {
        console.log('Calling lambda as count=' + count);

        // Reset the counter
        await CheatingBatchCount.findByIdAndUpdate(cheatingBatchCount._id, { $set: { counter: 0 } }).exec();
        console.log('Cheating detected!'); // Add this line to check if this block is executed
       
        // Fetch exam details
        const exam = await Assessment.findById(examId).populate({
          path: 'course',
          populate: {
            path: 'enrollments.user',
            model: 'User'
          }
        });

        const examType = exam.questionsType;
        const instructors = exam.course.enrollments
          .filter((val) => val.enrolledAs === 'instructor')
          .map((item) => item.user.email);

        try {
          // Call the AWS Lambda function
          await axios.post(awsCheatingDetectionUrl, {
            path: `${user.name}:${user._id}`,
            username: user.name,
            userId: user._id,
            examId: examId,
            examType: examType,
            InstructorEmail: instructors
          });

          console.log('Lambda called without errors');

          // Cheating detected, send notification to instructor
          const result = await notifyInstructor(user._id, user.name, examId);
          console.log('Notification result:', result);
        } catch (error) {
          console.error(error);
          throw new Error('Error in lambda: ' + error.message);
        }
      } else {
        // Update the counter
        await CheatingBatchCount.findByIdAndUpdate(cheatingBatchCount._id, { $set: { counter: count } }).exec();
        console.log('Counter found:', count);
      }

      return count.toString();
    }
  } catch (error) {
    console.error(error);
    throw new Error('Error in cheating detection: ' + error.message);
  }
};

// Function to send notification to instructor
const notifyInstructor = async (userId, username, examId) => {
  try {
    const student = await User.findById(userId).exec();

    if (!student) {
      throw new Error('Invalid studentId');
    }

    // Push notification to the instructor using examId and the student
    await pushNotification(
      student,
      JSON.stringify({
        title: `Cheating action detected. Review with the instructor for the case report.`
      })
    );

    return 'Notified';
  } catch (error) {
    console.error(error);
    throw new Error('Error in notifying instructor: ' + error.message);
  }
};

const detectCheating = async (req, res) => {
  try {
    const user = req.user;
    const count = await callLambdaForCheatingDetection(user, req.body.examId);
    res.status(200).send(count);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error in detecting cheating: ' + error.message);
  }
};

const clear = async (req, res) => {
  try {
    const user = req.user;
    await CheatingBatchCount.findOneAndDelete({ student: user }).exec();
    console.log('Counter cleared');
    res.status(200).send('Cleared');
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message);
  }
};

const getResult = async (req, res) => {
  try {
    const userId = req.body.userId;
    const username = req.body.username;
    const examId = req.body.examId;

    const result = await notifyInstructor(userId, username, examId);

    res.status(200).send(result);
  } catch (error) {
    console.error(error);
    res.status(400).send('Error in getting result: ' + error.message);
  }
};

module.exports = { detectCheating, clear, getResult };
