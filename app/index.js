import React, { Component } from "react";
import PropTypes from "prop-types";
import throttle from "./utils/throttle";
import { ThresholdUnits, parseThreshold } from "./utils/threshold";

export default class InfiniteScroll extends Component {
  constructor(props) {
    super();
    this.state = {
      showLoader: false,
      lastScrollTop: 0,
      actionTriggered: false,
      pullToRefreshThresholdBreached: false
    };
    // variables to keep track of pull behaviour
    this.startY = 0;
    this.currentY = 0;
    this.dragging = false;
    // will be populated in componentDidMount
    // based on the height of the pull element
    this.maxPullDistance = 0;

    this.onScrollListener = this.onScrollListener.bind(this);
    this.throttledOnScrollListener = throttle(this.onScrollListener, 150).bind(
      this
    );
    this.onStart = this.onStart.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);
    this.getScrollableTarget = this.getScrollableTarget.bind(this);
  }

  componentDidMount() {
    this._scrollableNode = this.getScrollableTarget();
    this.el = this.props.height
      ? this._infScroll
      : this._scrollableNode || window;
    this.el.addEventListener("scroll", this.throttledOnScrollListener);

    if (
      typeof this.props.initialScrollY === "number" &&
      this.el.scrollHeight > this.props.initialScrollY
    ) {
      this.el.scrollTo(0, this.props.initialScrollY);
    } else if (this.props.invert) {
      this.el.scrollTo(0, this.el.scrollHeight);
    }

    if (this.props.pullToRefresh) {
      this.el.addEventListener("touchstart", this.onStart);
      this.el.addEventListener("touchmove", this.onMove);
      this.el.addEventListener("touchend", this.onEnd);

      this.el.addEventListener("mousedown", this.onStart);
      this.el.addEventListener("mousemove", this.onMove);
      this.el.addEventListener("mouseup", this.onEnd);

      // get BCR of pull element to position it above
      this.maxPullDistance = this.props.invert ? this._pullControl.lastChild.getBoundingClientRect().height : this._pullControl.firstChild.getBoundingClientRect().height;
      this.forceUpdate();

      if (typeof this.props.refreshFunction !== "function") {
        throw new Error(
          `Mandatory prop "refreshFunction" missing.
          Pull To Refresh functionality will not work
          as expected. Check README.md for usage'`
        );
      }
    }
  }

  componentWillUnmount() {
    this.el.removeEventListener("scroll", this.throttledOnScrollListener);

    if (this.props.pullToRefresh) {
      this.el.removeEventListener("touchstart", this.onStart);
      this.el.removeEventListener("touchmove", this.onMove);
      this.el.removeEventListener("touchend", this.onEnd);

      this.el.removeEventListener("mousedown", this.onStart);
      this.el.removeEventListener("mousemove", this.onMove);
      this.el.removeEventListener("mouseup", this.onEnd);
    }
  }

  componentWillReceiveProps(props) {
    // do nothing when dataLength and key are unchanged
    if (this.props.key === props.key && this.props.dataLength === props.dataLength) return;

    // update state when new data was sent in
    this.setState({
      showLoader: false,
      actionTriggered: false,
      pullToRefreshThresholdBreached: false
    });
  }

  getScrollableTarget() {
    if (this.props.scrollableTarget instanceof HTMLElement) return this.props.scrollableTarget;
    if (typeof this.props.scrollableTarget === 'string') {
      return document.getElementById(this.props.scrollableTarget);
    }
    if (this.props.scrollableTarget === null) {
      console.warn(`You are trying to pass scrollableTarget but it is null. This might
        happen because the element may not have been added to DOM yet.
        See https://github.com/ankeetmaini/react-infinite-scroll-component/issues/59 for more info.
      `);
    }
    return null;
  }

  onStart(evt) {
    if (this.state.lastScrollTop) return;

    this.dragging = true;
    this.startY = evt.pageY || evt.touches[0].pageY;
    this.currentY = this.startY;

    this._infScroll.style.willChange = "transform";
    this._infScroll.style.transition = `transform 0.2s cubic-bezier(0,0,0.31,1)`;
  }

  onMove(evt) {
    if (!this.dragging) return;
    this.currentY = evt.pageY || evt.touches[0].pageY;

    if (this.props.invert && this.currentY - this.startY <= this.props.pullToRefreshThreshold) {
      this.setState({
        pullToRefreshThresholdBreached: true
      });
    }

    if (!this.props.invert && this.currentY - this.startY >= this.props.pullToRefreshThreshold) {
      this.setState({
        pullToRefreshThresholdBreached: true
      });
    }

    // so you can drag upto 1.5 times of the maxPullDistance
    if (!this.props.invert && this.currentY - this.startY > this.maxPullDistance * 1.5) return;
    if (this.props.invert && this.currentY - this.startY < this.maxPullDistance * 1.5) return;

    this._infScroll.style.overflow = "visible";
    this._infScroll.style.transform = `translate3d(0px, ${this.currentY -
      this.startY}px, 0px)`;
  }

  onEnd(evt) {
    this.startY = 0;
    this.currentY = 0;

    this.dragging = false;

    if (this.state.pullToRefreshThresholdBreached) {
      this.props.refreshFunction && this.props.refreshFunction();
    }

    requestAnimationFrame(() => {
      // this._infScroll
      if (this._infScroll) {
          this._infScroll.style.overflow = "auto";
          this._infScroll.style.transform = "none";
          this._infScroll.style.willChange = "none";
      }
    });
  }

  isElementPastThreshold(target, scrollThreshold = 0.8) {
    const clientHeight =
      target === document.body || target === document.documentElement
        ? window.screen.availHeight
        : target.clientHeight;

    const threshold = parseThreshold(scrollThreshold);



    if (this.props.invert) {
      if (threshold.unit === ThresholdUnits.Pixel) {
        return (
          target.scrollTop + clientHeight <= target.scrollHeight + threshold.value
        );
      }

      return (
        target.scrollTop + clientHeight <= (1 - threshold.value) / 100 * target.scrollHeight
      );
    }

    if (threshold.unit === ThresholdUnits.Pixel) {
      return (
        target.scrollTop + clientHeight >= target.scrollHeight - threshold.value
      );
    }

    return (
      target.scrollTop + clientHeight >= threshold.value / 100 * target.scrollHeight
    );
  }

  onScrollListener(event) {
    if (typeof this.props.onScroll === "function") {
      // Execute this callback in next tick so that it does not affect the
      // functionality of the library.
      setTimeout(() => this.props.onScroll(event), 0);
    }

    let target =
      this.props.height || this._scrollableNode
        ? event.target
        : document.documentElement.scrollTop
          ? document.documentElement
          : document.body;

    // return immediately if the action has already been triggered,
    // prevents multiple triggers.
    if (this.state.actionTriggered) return;

    let atThreshold = this.isElementPastThreshold(target, this.props.scrollThreshold);

    // call the `next` function in the props to trigger the next data fetch
    if (atThreshold && this.props.hasMore) {
      this.setState({ actionTriggered: true, showLoader: true });
      this.props.next();
    }
    this.setState({ lastScrollTop: target.scrollTop });
  }

  render() {
    const style = {
      height: this.props.height || "auto",
      overflow: "auto",
      WebkitOverflowScrolling: "touch",
      ...this.props.style
    };
    const hasChildren =
      this.props.hasChildren ||
      !!(this.props.children && this.props.children.length);

    // because heighted infiniteScroll visualy breaks
    // on drag as overflow becomes visible
    const outerDivStyle =
      this.props.pullToRefresh && this.props.height
        ? { overflow: "auto" }
        : {};

    let pullToRefreshStyle = {
      position: "absolute",
      left: 0,
      right: 0
    };

    if (this.props.invert) {
      pullToRefreshStyle = {
        ...pullToRefreshStyle,
        top: -1 * this.maxPullDistance
      };
    } else {
      pullToRefreshStyle = {
        ...pullToRefreshStyle,
        bottom: -1 * this.maxPullDistance
      };
    }

    const pullToRefreshContent = (
      <div
        style={{ position: "relative" }}
        ref={pullControl => (this._pullControl = pullControl)}
      >
        <div
          style={pullToRefreshStyle}
        >
          {!this.state.pullToRefreshThresholdBreached &&
            this.props.pullToRefreshContent}
          {this.state.pullToRefreshThresholdBreached &&
            this.props.releaseToRefreshContent}
        </div>
      </div>
    );

    return (
      <div style={outerDivStyle}>
        <div
          className={`infinite-scroll-component ${this.props.className || ''}`}
          ref={infScroll => (this._infScroll = infScroll)}
          style={style}
        >
          {this.props.pullToRefresh && !this.props.invert && pullToRefreshContent}
          {this.props.invert &&
            !this.state.showLoader &&
            !hasChildren &&
            this.props.hasMore &&
            this.props.loader}
          {this.props.invert && this.state.showLoader && this.props.hasMore && this.props.loader}
          {this.props.invert && !this.props.hasMore && this.props.endMessage}
          {this.props.children}
          {!this.props.invert &&
            !this.state.showLoader &&
            !hasChildren &&
            this.props.hasMore &&
            this.props.loader}
          {!this.props.invert && this.state.showLoader && this.props.hasMore && this.props.loader}
          {!this.props.invert && !this.props.hasMore && this.props.endMessage}
          {this.props.pullToRefresh && this.props.invert && pullToRefreshContent}
        </div>
      </div>
    );
  }
}

InfiniteScroll.defaultProps = {
  pullToRefreshContent: <h3>Pull to refresh</h3>,
  releaseToRefreshContent: <h3>Release to refresh</h3>,
  pullToRefreshThreshold: 100,
  disableBrowserPullToRefresh: true,
  invert: false
};

InfiniteScroll.propTypes = {
  next: PropTypes.func,
  hasMore: PropTypes.bool,
  children: PropTypes.node,
  loader: PropTypes.node.isRequired,
  scrollThreshold: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  endMessage: PropTypes.node,
  style: PropTypes.object,
  height: PropTypes.number,
  scrollableTarget: PropTypes.node,
  hasChildren: PropTypes.bool,
  pullToRefresh: PropTypes.bool,
  pullToRefreshContent: PropTypes.node,
  releaseToRefreshContent: PropTypes.node,
  pullToRefreshThreshold: PropTypes.number,
  refreshFunction: PropTypes.func,
  onScroll: PropTypes.func,
  dataLength: PropTypes.number.isRequired,
  key: PropTypes.string,
  invert: PropTypes.bool
};
