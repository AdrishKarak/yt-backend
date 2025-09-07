import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const genarateAccesAndRefereshToken = async(userId) =>{
  try{
  const user = await User.findById(userId)
   const accessToken =  user.generateAccessToken
    const refreshToken = user.generateRefreshToken

    user.refreshToken = refreshToken
     await user.save({validateBeforeSave: false})

    return {accessToken , refreshToken}

  } catch(error) {
    throw new ApiError(500, "Something went wrong");
  }
}

const registerUser = asyncHandler(async (req, res) => {
  console.log("BODY:", req.body);
  console.log("FILES:", req.files);

  // Get user details from the frontend
  const { fullName, email, username, password } = req.body;

  // Validation
  if ([fullName, email, username, password].some((field) => !field || field.trim() === "")) {
    throw new ApiError("All fields (fullName, email, username, password) are required", 400);
  }

  // User already exists: username or email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError("User already exists", 409);
  }

  // Check for images
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError("Avatar is required", 400);
  }

  // Upload to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  let coverImage = null;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  if (!avatar) {
    throw new ApiError("Avatar upload failed", 400);
  }

  // Create user object - entry in DB
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    username: username.toLowerCase(),
    password,
  });

  // Remove password and refreshToken from response
  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError("User creation failed while creating the user", 500);
  }

  // Return response
  return res.status(201).json(
    new ApiResponse(201, createdUser, "User created successfully")
  );
});

const loginUser = asyncHandler(async (req, res) => {
//req body -> data,
  //username or email
  //find the user
  //check password
  //access & refresh token
  //send cookies

  const {email , username , password} = req.body;

  if(!username && !email){
    throw new ApiError("username or email is required", 400)
  }

  //if we wanted or --> if(!(username || email))

  const user = await User.findOne({
    $or: [{ username }, { email }],
  })

  if(!user){
    throw new ApiError("User not found", 404)
  }
  const isPasswordValid= await user.isPaswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiError("Passwords do not match", 401)
  }

  const {accessToken , refreshToken}= await genarateAccesAndRefereshToken(user._id)

  const loggedInUser = await User.findById(user._id)
  .select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200).cookie("accessToken", accessToken, options)
                        .cookie("refreshToken", refreshToken, options)
                        .json(
                              new ApiResponse(200,  {
                                            user: loggedInUser,accessToken, refreshToken
                              } , "User logged in successfully"
                              )
                        )
  })

  const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
     req.user._id,
     {
       $set: {
         refreshToken: undefined
       }
     },
     {
       new: true
     }
   )
    const options = {
    httpOnly: true,
    secure: true
    }
 return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, {}, "User logged out successfully"))
  })

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if(!incomingRefreshToken){
    throw new ApiError("Unauthorised request", 401)
  }

 try {
   const decodedToken=jwt.verify(incomingRefreshToken,
     process.env.REFRESH_TOKEN_SECRET,
   )
   const user = await User.findById(decodedToken?._id)

   if(!user){
     throw new ApiError("Invalid refresh token", 401)
   }

   if(incomingRefreshToken !== user?.refreshToken){
     throw new ApiError("Refresh token is expired", 401)
   }

   const options = {
     httpOnly: true,
     secure: true
   }

   const {accessToken , newRefreshToken}=await  genarateAccesAndRefereshToken(user._id)

   return res.status(200).cookie("accessToken" , accessToken, options).cookie("refreshToken", newRefreshToken, options).json(
     new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access token refreshed successfully")
   )

 } catch (error) {
   throw new ApiError( error?.message || "Invalid refresh token", 401)
 }
})

export { registerUser ,
         loginUser,
       logoutUser ,
  refreshAccessToken};
