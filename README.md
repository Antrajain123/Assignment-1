# BITS WILP - Assignment 1

This repository contains both applications developed for the assignment on Specification-Driven Development (SDD) and Harness Engineering.

## Part 1A - DayFlow

DayFlow is a Smart Todo and Task Manager API built using Node.js and Express.

Features:
- Create, retrieve, update, and delete tasks.
- Task status and priority management.
- JSON file-based persistence.
- Input validation and API error handling.
- Automated tests and validation evidence.
- Specification and implementation artifacts created using Spec Kit.

Project folder: Part-1A/

## Part 1B - Natural Language Reminder Agent

A Natural Language Reminder API built using Node.js, Express, Google Gemini API, and Zod.

Features:
- Interpret natural-language reminder requests.
- Generate structured reminder data using Gemini.
- Validate AI responses using Zod schemas.
- Apply deterministic validation and guardrails.
- Evaluate outputs using a test dataset.
- Preserve initial and final evaluation evidence.

Note: This application interprets and validates reminders. It does not schedule or deliver actual notifications.

Project folder: Part-1B/

## Repository Structure

    Assignment-1/
    ├── README.md
    ├── Part-1A/
    │   ├── src/
    │   ├── test/
    │   ├── specs/
    │   └── evidence/
    └── Part-1B/
        ├── src/
        ├── tests/
        ├── specs/
        └── evaluation/

## Technologies Used

- Node.js
- JavaScript
- Express.js
- Google Gemini API
- Zod
- Spec Kit
- Git and GitHub

## Security

- Actual API keys and local environment files are excluded from Git.
- Use .env.example as a configuration template.
- Never commit actual credentials.

## Running the Projects

Refer to the README and quickstart documentation inside each project folder for installation, configuration, and execution instructions.