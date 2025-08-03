#!/bin/bash

# SplitChey Build Script
# This script helps with local development and testing

set -e

echo "🚀 SplitChey Build Script"
echo "=========================="

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  ios     - Build iOS app"
    echo "  android - Build Android app"
    echo "  web     - Build web app"
    echo "  clean   - Clean build artifacts"
    echo "  test    - Run tests"
    echo "  lint    - Run linting"
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 ios     # Build iOS app"
    echo "  $0 android # Build Android app"
    echo "  $0 clean   # Clean build artifacts"
}

# Function to clean build artifacts
clean_build() {
    echo "🧹 Cleaning build artifacts..."
    rm -rf build/
    rm -rf dist/
    rm -rf web-build/
    rm -rf ios/build/
    rm -rf android/build/
    rm -rf android/app/build/
    echo "✅ Build artifacts cleaned"
}

# Function to run tests
run_tests() {
    echo "🧪 Running tests..."
    npm test
    echo "✅ Tests completed"
}

# Function to run linting
run_lint() {
    echo "🔍 Running linting..."
    npm run lint
    echo "✅ Linting completed"
}

# Function to build iOS
build_ios() {
    echo "📱 Building iOS app..."
    
    # Check if we're on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo "❌ iOS builds require macOS"
        exit 1
    fi
    
    # Install dependencies
    npm install
    
    # Build iOS
    npx expo build:ios --non-interactive
    
    echo "✅ iOS build completed"
}

# Function to build Android
build_android() {
    echo "🤖 Building Android app..."
    
    # Install dependencies
    npm install
    
    # Build Android
    npx expo build:android --non-interactive
    
    echo "✅ Android build completed"
}

# Function to build web
build_web() {
    echo "🌐 Building web app..."
    
    # Install dependencies
    npm install
    
    # Build web
    npx expo build:web
    
    echo "✅ Web build completed"
}

# Main script logic
case "${1:-help}" in
    ios)
        build_ios
        ;;
    android)
        build_android
        ;;
    web)
        build_web
        ;;
    clean)
        clean_build
        ;;
    test)
        run_tests
        ;;
    lint)
        run_lint
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo "❌ Unknown option: $1"
        show_usage
        exit 1
        ;;
esac 