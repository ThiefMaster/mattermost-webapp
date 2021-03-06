// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';

import {getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import {FileTypes, StoragePrefixes} from 'utils/constants.jsx';
import {
    getFileType,
    localizeMessage,
} from 'utils/utils';

import {postListScrollChange} from 'actions/global_actions.jsx';

import LoadingImagePreview from 'components/loading_image_preview';
import ViewImageModal from 'components/view_image';

import BrowserStore from 'stores/browser_store.jsx';

const PREVIEW_IMAGE_MAX_WIDTH = 1024;
const PREVIEW_IMAGE_MAX_HEIGHT = 350;
const PREVIEW_IMAGE_MIN_DIMENSION = 50;

export default class SingleImageView extends React.PureComponent {
    static propTypes = {

        /**
         * FileInfo to view
         **/
        fileInfo: PropTypes.object.isRequired,
        isRhsOpen: PropTypes.bool.isRequired,
        isEmbedVisible: PropTypes.bool,
    };

    static defaultProps = {
        fileInfo: {},
    };

    constructor(props) {
        super(props);

        this.state = {
            loaded: false,
            showPreviewModal: false,
            viewPortWidth: 0,
        };

        this.imageLoaded = null;
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        this.setViewPortWidth();
        this.loadImage(this.props.fileInfo);

        // Timeout used to delay execution until after current render cycle
        setTimeout(postListScrollChange, 0);
    }

    UNSAFE_componentWillReceiveProps(nextProps) { // eslint-disable-line camelcase
        this.loadImage(nextProps.fileInfo);

        if (nextProps.isRhsOpen !== this.props.isRhsOpen) {
            this.handleResize();
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    handleResize = () => {
        this.setViewPortWidth();
    }

    setViewPortRef = (node) => {
        this.viewPort = node;
    }

    setViewPortWidth = () => {
        if (this.viewPort && this.viewPort.getBoundingClientRect) {
            const rect = this.viewPort.getBoundingClientRect();
            this.setState({viewPortWidth: rect.width});
        }
    }

    loadImage = (fileInfo) => {
        const {has_preview_image: hasPreviewImage, id} = fileInfo;
        const fileURL = getFileUrl(id);
        const previewURL = hasPreviewImage ? getFilePreviewUrl(id) : fileURL;

        const loaderImage = new Image();

        loaderImage.src = previewURL;
        loaderImage.onload = () => {
            if (this.imageLoaded) {
                this.imageLoaded.src = previewURL;
            }

            this.setState({loaded: true});
        };
    }

    handleImageClick = (e) => {
        e.preventDefault();
        this.setState({showPreviewModal: true});
    }

    showPreviewModal = () => {
        this.setState({showPreviewModal: false});
    }

    setImageLoadedRef = (node) => {
        this.imageLoaded = node;
    }

    computeImageDimensions = () => {
        const {fileInfo} = this.props;
        const viewPortWidth = this.state.viewPortWidth;

        let previewWidth = fileInfo.width;
        let previewHeight = fileInfo.height;

        if (viewPortWidth && previewWidth > viewPortWidth) {
            const origRatio = fileInfo.height / fileInfo.width;
            previewWidth = Math.min(PREVIEW_IMAGE_MAX_WIDTH, fileInfo.width, viewPortWidth);
            previewHeight = previewWidth * origRatio;
        }

        if (previewHeight > PREVIEW_IMAGE_MAX_HEIGHT) {
            const heightRatio = PREVIEW_IMAGE_MAX_HEIGHT / previewHeight;
            previewHeight = PREVIEW_IMAGE_MAX_HEIGHT;
            previewWidth *= heightRatio;
        }

        return {previewWidth, previewHeight};
    }

    toggleEmbedVisibility = () => {
        BrowserStore.setGlobalItem(StoragePrefixes.EMBED_VISIBLE + this.props.fileInfo.post_id, !this.props.isEmbedVisible);
    }

    render() {
        const {fileInfo} = this.props;
        const {
            loaded,
            viewPortWidth,
        } = this.state;

        const {previewHeight, previewWidth} = this.computeImageDimensions();
        let minPreviewClass = '';
        if (
            previewWidth < PREVIEW_IMAGE_MIN_DIMENSION ||
            previewHeight < PREVIEW_IMAGE_MIN_DIMENSION
        ) {
            minPreviewClass = 'min-preview ';

            if (previewHeight > previewWidth) {
                minPreviewClass += 'min-preview--portrait ';
            }
        }

        const toggle = (
            <a
                key='toggle'
                className='post__embed-visibility'
                aria-label='Toggle Embed Visibility'
                onClick={this.toggleEmbedVisibility}
            />
        );

        const fileHeader = (
            <div
                className='image-name'
                onClick={this.handleImageClick}
            >
                {fileInfo.name}
            </div>
        );

        const loading = localizeMessage('view_image.loading', 'Loading');

        let viewImageModal;
        let loadingImagePreview;
        let fadeInClass = '';

        let height = previewHeight;
        if (height < PREVIEW_IMAGE_MIN_DIMENSION) {
            height = PREVIEW_IMAGE_MIN_DIMENSION;
        }

        let width = previewWidth;
        if (width < PREVIEW_IMAGE_MIN_DIMENSION) {
            width = PREVIEW_IMAGE_MIN_DIMENSION;
        }

        const fileType = getFileType(fileInfo.extension);
        let svgClass = '';
        let imageStyle = {height};
        let imageLoadedStyle = {height};
        let imageContainerStyle = {};
        if (width < viewPortWidth && height === PREVIEW_IMAGE_MAX_HEIGHT) {
            imageContainerStyle = {width};
        } else if (fileType === FileTypes.SVG) {
            svgClass = 'post-image normal';
            imageStyle = {};
            imageLoadedStyle = {};
            imageContainerStyle = {
                width: viewPortWidth < PREVIEW_IMAGE_MAX_HEIGHT ? viewPortWidth : PREVIEW_IMAGE_MAX_HEIGHT,
                height: PREVIEW_IMAGE_MAX_HEIGHT,
            };
        }

        if (loaded) {
            viewImageModal = (
                <ViewImageModal
                    show={this.state.showPreviewModal}
                    onModalDismissed={this.showPreviewModal}
                    fileInfos={[fileInfo]}
                />
            );

            fadeInClass = 'image-fade-in';
            imageStyle = {cursor: 'pointer'};
            imageLoadedStyle = {};

            if (fileType === FileTypes.SVG) {
                imageContainerStyle = {width: viewPortWidth < PREVIEW_IMAGE_MAX_HEIGHT ? viewPortWidth : PREVIEW_IMAGE_MAX_HEIGHT};
            }
        } else if (this.props.isEmbedVisible) {
            loadingImagePreview = (
                <LoadingImagePreview
                    loading={loading}
                    containerClass={'file__image-loading'}
                />
            );
        }

        let image;
        if (this.props.isEmbedVisible) {
            image = (
                <img
                    ref={this.setImageLoadedRef}
                    style={imageStyle}
                    className={`${minPreviewClass} ${svgClass}`}
                    onClick={this.handleImageClick}
                />
            );
        }

        return (
            <div
                ref='singleImageView'
                className={`${'file-view--single'}`}
            >
                <div
                    ref={this.setViewPortRef}
                    className='file__image'
                >
                    {toggle} {fileHeader}
                    {this.props.isEmbedVisible &&
                    <div
                        className='image-container'
                        style={imageContainerStyle}
                    >
                        <div
                            className={`image-loaded ${fadeInClass}`}
                            style={imageLoadedStyle}
                        >
                            {image}
                        </div>
                        <div className='image-preload'>
                            {loadingImagePreview}
                        </div>
                    </div>
                    }
                    {viewImageModal}
                </div>
            </div>
        );
    }
}
