import { Router } from 'express';
import UsersController from '@controllers/users.controller';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import passport from 'passport'
import { log } from 'winston';
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const AppleStrategy = require('passport-apple').Strategy;

class UsersRoute implements Routes {
  public path = '/users';
  public router = Router();
  public usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }


  private initializeRoutes() {

    let userProfile;
    // demo of google oauth2.0 
    // Configure Passport.js for Facebook
    passport.use(new FacebookStrategy({
      clientID: "FACEBOOK_CLIENT_ID",
      clientSecret: "FACEBOOK_CLIENT_SECRET",
      callbackURL: "FACEBOOK_CALLBACK_URL",
      profileFields: ['id', 'email', 'first_name', 'last_name'],
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile, accessToken, refreshToken);
    }
    ));

    // Configure Passport.js for Google
    passport.use(new GoogleStrategy({
      clientID: process.env.Google_Client_Id,
      clientSecret:  process.env.Google_Client_Secret,
      callbackURL: 'https://userapi.orthoai.in/auth/google/callback'
    },
      (accessToken, refreshToken, profile, done) => {
        console.log(profile._json)
        return done(null,{
        id: profile._json.sub,
        email: profile._json.email,
        displayName: profile._json.name,
        firstName: profile._json.given_name,
        lastName: profile._json.family_name,
        picture: profile._json.picture
        });
      }
    ));

    // Add similar configurations for Microsoft and Apple strategies
    passport.use(new MicrosoftStrategy({
      clientID: "FACEBOOK_CLIENT_ID",
      clientSecret: "FACEBOOK_CLIENT_SECRET",
      callbackURL: "FACEBOOK_CALLBACK_URL",
      profileFields: ['id', 'email', 'first_name', 'last_name'],
    },
      (accessToken, refreshToken, profile, done) => {
        return done(null, profile, accessToken, refreshToken);
      }
    ));

    passport.use(new AppleStrategy({
      clientID: "FACEBOOK_CLIENT_ID",
      clientSecret: "FACEBOOK_CLIENT_SECRET",
      callbackURL: "FACEBOOK_CALLBACK_URL",
      profileFields: ['id', 'email', 'first_name', 'last_name'],
    },
      (accessToken, refreshToken, profile, done) => {
        return done(null, profile, accessToken, refreshToken);
      }
    ));

    // Serialization and deserialization (same as in previous examples)
    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((user, done) => {
      done(null, user);
    });


    // this.router.post(`${this.path}/login`, this.usersController.login);
    // this.router.post(`${this.path}/createUser`, this.usersController.createUser);
    // this.router.get(`${this.path}/getAllUser`, this.usersController.getUsers);


    //   this.router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    //   this.router.get('/auth/google/callback', passport.authenticate('google', {
    //     failureRedirect: '/error',
    //     session: false
    //   }),
    //     function (req, res) {
    //       // Successful authentication, redirect success.

    //       res.redirect(`/users/getAllUser?email=${userProfile._json.email}`);
    //     });

    // Define routes for authentication
    this.router.get('/auth/facebook', passport.authenticate('facebook'));
    this.router.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/profile', failureRedirect: '/login' }));

    this.router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    this.router.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/login',failureFlash: true}), this.usersController.loginWithGoogle);

    this.router.get('/auth/apple', passport.authenticate('apple'));
    this.router.get('/auth/apple/callback', passport.authenticate('apple', { successRedirect: '/profile', failureRedirect: '/login' }));

    this.router.get('/auth/microsoft', passport.authenticate('microsoft', { scope: ['profile', 'email'] }));
    this.router.get('/auth/microsoft/callback', passport.authenticate('microsoft', { successRedirect: '/profile', failureRedirect: '/login' }));

    this.router.post(`${this.path}/subscribe`, authMiddleware, this.usersController.subscribe);
    this.router.post(`${this.path}/QA/saveQuestion`, authMiddleware, this.usersController.saveQuestion);
    this.router.post(`${this.path}/QA/updateAnswerOrError`, this.usersController.updateAnswerOrError);

    this.router.post(`${this.path}/getWorkspacesByUserId`, authMiddleware, this.usersController.getWorkspacesByUserId);
    this.router.post(`${this.path}/deleteWorkspaceId`, authMiddleware, this.usersController.deleteWorkspaceId);

    this.router.get(`/getSubsciptionPlan`, this.usersController.getSubsciptionPlan);


    //discover apis
    this.router.get(`${this.path}/discover`, this.usersController.discover);

    this.router.get('/profile', (req, res) => {
      // Access user data from req.user and display it on the profile page
      res.send(req);
    });

    this.router.get('/', (req, res) => {
      res.send('Home Page');
    });

  }
}

export default UsersRoute;